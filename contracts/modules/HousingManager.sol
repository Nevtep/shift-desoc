// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IModuleProduct} from "./interfaces/IModuleProduct.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Errors} from "../libs/Errors.sol";

/**
 * @title HousingManager
 * @notice Co-housing reservation system with investor staking and worker discounts
 * @dev Implements IModuleProduct for Marketplace integration
 *
 * Key Features:
 * - Unit ownership tracking via ERC1155 tokens (1 per unit)
 * - Investor staking for backing discounts and quality assurance
 * - Reservation lifecycle with check-in/check-out
 * - Flexible cancellation policies per unit
 * - Marketplace integration via quote/consume/onOrderSettled callbacks
 *
 * Architecture:
 * - Units: Physical spaces with ownership, capacity, pricing
 * - Reservations: Time-bound bookings linked to Marketplace orders
 * - Staking: Investors lock USDC to back units (tracked separately from UnitToken)
 * - Discounts: Community members (ValuableActionSBT holders) get lower rates
 */
contract HousingManager is IModuleProduct, ERC1155Supply {
    // ============ Constants ============

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MIN_STAY_NIGHTS = 1;

    // Cancellation refund tiers
    uint256 public constant CANCEL_FULL_REFUND_DAYS = 7; // >7 days = 100% refund
    uint256 public constant CANCEL_HALF_REFUND_DAYS = 3; // 3-7 days = 50% refund
    // <3 days = 0% refund (default)

    // ============ Types ============

    struct Unit {
        uint256 unitId;
        uint256 communityId;
        address owner; // Owner of UnitToken (ERC1155)
        string metadataURI;
        uint256 basePrice; // Price per night in stablecoin
        uint256 capacity; // Max guests
        bool active; // Whether unit can be reserved
        uint256 stakedBacking; // Total USDC staked by investors
        uint256 cancellationPolicyBps; // Custom refund % if set (0 = use default tiers)
    }

    struct Reservation {
        uint256 reservationId;
        uint256 unitId;
        uint256 orderId; // Marketplace order ID
        address guest;
        uint64 checkInDate; // Unix timestamp (day precision)
        uint64 checkOutDate; // Unix timestamp (day precision)
        uint256 totalPrice; // Amount paid via Marketplace
        ReservationStatus status;
        uint64 checkedInAt; // Actual check-in timestamp (0 if never)
        uint64 checkedOutAt; // Actual check-out timestamp (0 if never)
    }

    enum ReservationStatus {
        NONE,
        PENDING, // Created via Marketplace purchase
        CHECKED_IN, // Guest checked in
        CHECKED_OUT, // Guest checked out
        CANCELLED, // Cancelled (pre-check-in)
        REFUNDED // Refunded via dispute
    }

    // ============ State ============

    mapping(uint256 => Unit) public units;
    uint256 public nextUnitId = 1;

    mapping(uint256 => Reservation) public reservations;
    uint256 public nextReservationId = 1;

    // Availability tracking
    mapping(uint256 => mapping(uint256 => bool)) public unitOccupied; // unitId => dayTimestamp => occupied

    // Marketplace integration
    address public marketplace;
    mapping(uint256 => uint256) public orderToReservation; // orderId => reservationId

    // Staking tracking (separate from UnitToken ownership)
    mapping(uint256 => mapping(address => uint256)) public investorStakes; // unitId => investor => amount

    // Stablecoin for investor staking
    address public stablecoin;

    // Access control
    address public owner;

    // ============ Events ============

    event UnitCreated(uint256 indexed unitId, uint256 indexed communityId, address indexed owner, uint256 basePrice);

    event UnitUpdated(uint256 indexed unitId, bool active, uint256 basePrice);

    event UnitStaked(uint256 indexed unitId, address indexed investor, uint256 amount, uint256 totalStaked);

    event UnitUnstaked(uint256 indexed unitId, address indexed investor, uint256 amount, uint256 totalStaked);

    event ReservationCreated(
        uint256 indexed reservationId,
        uint256 indexed unitId,
        uint256 indexed orderId,
        address guest,
        uint64 checkInDate,
        uint64 checkOutDate
    );

    event CheckedIn(uint256 indexed reservationId, uint64 timestamp);

    event CheckedOut(uint256 indexed reservationId, uint64 timestamp);

    event ReservationCancelled(uint256 indexed reservationId, uint256 refundAmount);

    event ReservationRefunded(uint256 indexed reservationId);

    // ============ Errors ============

    error UnitNotFound(uint256 unitId);
    error UnitNotActive(uint256 unitId);
    error ReservationNotFound(uint256 reservationId);
    error InvalidDateRange(uint64 checkIn, uint64 checkOut);
    error UnitNotAvailable(uint256 unitId, uint64 checkIn, uint64 checkOut);
    error OnlyMarketplace();
    error OnlyOwner();
    error OnlyUnitOwner();
    error OnlyGuest();
    error InvalidStatus(ReservationStatus current, ReservationStatus required);
    error MinStayNotMet(uint256 nights, uint256 required);

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyMarketplace() {
        if (msg.sender != marketplace) revert OnlyMarketplace();
        _;
    }

    modifier unitExists(uint256 unitId) {
        if (units[unitId].unitId == 0) revert UnitNotFound(unitId);
        _;
    }

    modifier reservationExists(uint256 reservationId) {
        if (reservations[reservationId].reservationId == 0) {
            revert ReservationNotFound(reservationId);
        }
        _;
    }

    // ============ Constructor ============

    constructor(address _owner, address _marketplace, address _stablecoin) ERC1155("") {
        if (_owner == address(0)) revert Errors.ZeroAddress();
        if (_marketplace == address(0)) revert Errors.ZeroAddress();
        if (_stablecoin == address(0)) revert Errors.ZeroAddress();

        owner = _owner;
        marketplace = _marketplace;
        stablecoin = _stablecoin;
    }

    // ============ Admin Functions ============

    function setMarketplace(address _marketplace) external onlyOwner {
        marketplace = _marketplace;
    }

    // ============ Unit Management ============

    /**
     * @notice Create a new housing unit
     * @dev Mints UnitToken (ERC1155) to owner
     */
    function createUnit(
        uint256 communityId,
        address unitOwner,
        string calldata metadataURI,
        uint256 basePrice,
        uint256 capacity,
        uint256 cancellationPolicyBps
    ) external onlyOwner returns (uint256 unitId) {
        unitId = nextUnitId++;

        units[unitId] = Unit({
            unitId: unitId,
            communityId: communityId,
            owner: unitOwner,
            metadataURI: metadataURI,
            basePrice: basePrice,
            capacity: capacity,
            active: true,
            stakedBacking: 0,
            cancellationPolicyBps: cancellationPolicyBps
        });

        // Mint UnitToken (1 per unit, non-fungible within HousingManager context)
        _mint(unitOwner, unitId, 1, "");

        emit UnitCreated(unitId, communityId, unitOwner, basePrice);
    }

    /**
     * @notice Update unit status and pricing
     * @dev Only unit owner can modify
     */
    function updateUnit(uint256 unitId, bool active, uint256 basePrice) external unitExists(unitId) {
        Unit storage unit = units[unitId];
        if (msg.sender != unit.owner) revert OnlyUnitOwner();

        unit.active = active;
        if (basePrice > 0) {
            unit.basePrice = basePrice;
        }

        emit UnitUpdated(unitId, active, basePrice);
    }

    // ============ Investor Staking ============

    /**
     * @notice Stake USDC to back a unit
     * @dev Staking is tracked separately from UnitToken ownership
     */
    function stakeForUnit(uint256 unitId, uint256 amount) external unitExists(unitId) {
        Unit storage unit = units[unitId];

        if (amount == 0) revert Errors.InvalidInput("Zero amount");

        // Pull stablecoin from investor
        SafeERC20.safeTransferFrom(IERC20(stablecoin), msg.sender, address(this), amount);

        investorStakes[unitId][msg.sender] += amount;
        unit.stakedBacking += amount;

        emit UnitStaked(unitId, msg.sender, amount, unit.stakedBacking);
    }

    /**
     * @notice Unstake USDC from a unit
     * @dev Can only unstake what you previously staked
     */
    function unstakeFromUnit(uint256 unitId, uint256 amount) external unitExists(unitId) {
        Unit storage unit = units[unitId];
        uint256 currentStake = investorStakes[unitId][msg.sender];

        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (amount > currentStake) revert Errors.InvalidInput("Insufficient stake");

        investorStakes[unitId][msg.sender] -= amount;
        unit.stakedBacking -= amount;

        // Return stablecoin to investor
        SafeERC20.safeTransfer(IERC20(stablecoin), msg.sender, amount);

        emit UnitUnstaked(unitId, msg.sender, amount, unit.stakedBacking);
    }

    // ============ IModuleProduct Implementation ============

    /**
     * @notice Calculate reservation price with minimum stay validation
     * @param productId The unitId
     * @param params ABI-encoded (uint64 checkIn, uint64 checkOut)
     * @param basePrice Suggested price (overridden by unit.basePrice)
     * @return finalPrice Total price for the stay
     */
    function quote(uint256 productId, bytes calldata params, uint256 basePrice)
        external
        view
        override
        returns (uint256 finalPrice)
    {
        basePrice; // base price intentionally ignored (unit's basePrice used)
        Unit storage unit = units[productId];
        if (unit.unitId == 0) revert UnitNotFound(productId);

        (uint64 checkInTime, uint64 checkOutTime) = abi.decode(params, (uint64, uint64));

        // Validate date range
        if (checkOutTime <= checkInTime) revert InvalidDateRange(checkInTime, checkOutTime);

        // Calculate nights
        uint256 nights = (checkOutTime - checkInTime) / 1 days;
        if (nights < MIN_STAY_NIGHTS) revert MinStayNotMet(nights, MIN_STAY_NIGHTS);

        // Use unit's base price (ignore suggested basePrice)
        finalPrice = unit.basePrice * nights;
    }

    /**
     * @notice Create reservation (called by Marketplace on purchase)
     * @param productId The unitId
     * @param buyer The guest address
     * @param params ABI-encoded (uint64 checkIn, uint64 checkOut)
     * @param amountPaid Amount in escrow (from Marketplace)
     * @return resourceId The reservationId
     */
    function consume(uint256 productId, address buyer, bytes calldata params, uint256 amountPaid)
        external
        override
        onlyMarketplace
        returns (uint256 resourceId)
    {
        Unit storage unit = units[productId];
        if (unit.unitId == 0) revert UnitNotFound(productId);
        if (!unit.active) revert UnitNotActive(productId);

        (uint64 checkInTime, uint64 checkOutTime) = abi.decode(params, (uint64, uint64));

        // Validate availability
        if (!_isAvailable(productId, checkInTime, checkOutTime)) {
            revert UnitNotAvailable(productId, checkInTime, checkOutTime);
        }

        // Mark dates as occupied
        _markOccupied(productId, checkInTime, checkOutTime);

        // Create reservation
        resourceId = nextReservationId++;
        reservations[resourceId] = Reservation({
            reservationId: resourceId,
            unitId: productId,
            orderId: 0, // Set by caller (Marketplace) if needed
            guest: buyer,
            checkInDate: checkInTime,
            checkOutDate: checkOutTime,
            totalPrice: amountPaid,
            status: ReservationStatus.PENDING,
            checkedInAt: 0,
            checkedOutAt: 0
        });

        emit ReservationCreated(resourceId, productId, 0, buyer, checkInTime, checkOutTime);
    }

    /**
     * @notice Handle settlement outcomes from Marketplace
     * @param productId The unitId
     * @param resourceId The reservationId
     * @param outcome 1=PAID (settled), 2=REFUNDED (dispute)
     */
    function onOrderSettled(uint256 productId, uint256 resourceId, uint8 outcome) external override onlyMarketplace {
        productId; // unused in current flow; reserved for future logic
        Reservation storage reservation = reservations[resourceId];
        if (reservation.reservationId == 0) return; // Graceful handling for non-existent

        if (outcome == 2) {
            // REFUNDED - cancel reservation and free dates
            reservation.status = ReservationStatus.REFUNDED;
            _markAvailable(reservation.unitId, reservation.checkInDate, reservation.checkOutDate);
            emit ReservationRefunded(resourceId);
        }
        // outcome == 1 (PAID) - no action needed, reservation remains PENDING until check-in
    }

    // ============ Reservation Lifecycle ============

    /**
     * @notice Guest checks in
     * @dev Can only check in on or after checkInDate
     */
    function checkIn(uint256 reservationId) external reservationExists(reservationId) {
        Reservation storage reservation = reservations[reservationId];

        if (msg.sender != reservation.guest) revert OnlyGuest();
        if (reservation.status != ReservationStatus.PENDING) {
            revert InvalidStatus(reservation.status, ReservationStatus.PENDING);
        }
        if (block.timestamp < reservation.checkInDate) {
            revert Errors.InvalidInput("Too early to check in");
        }

        reservation.status = ReservationStatus.CHECKED_IN;
        reservation.checkedInAt = uint64(block.timestamp);

        emit CheckedIn(reservationId, reservation.checkedInAt);
    }

    /**
     * @notice Guest checks out
     * @dev Can only check out after checking in
     */
    function checkOut(uint256 reservationId) external reservationExists(reservationId) {
        Reservation storage reservation = reservations[reservationId];

        if (msg.sender != reservation.guest) revert OnlyGuest();
        if (reservation.status != ReservationStatus.CHECKED_IN) {
            revert InvalidStatus(reservation.status, ReservationStatus.CHECKED_IN);
        }

        reservation.status = ReservationStatus.CHECKED_OUT;
        reservation.checkedOutAt = uint64(block.timestamp);

        emit CheckedOut(reservationId, reservation.checkedOutAt);
    }

    /**
     * @notice Calculate cancellation refund based on policy
     * @dev Returns refund amount in BPS (10000 = 100%)
     */
    function getCancellationRefundBps(uint256 reservationId) public view returns (uint256 refundBps) {
        Reservation storage reservation = reservations[reservationId];
        Unit storage unit = units[reservation.unitId];

        // If custom policy set, use it
        if (unit.cancellationPolicyBps > 0) {
            return unit.cancellationPolicyBps;
        }

        // Otherwise use default tiered policy
        uint256 daysUntilCheckIn = (reservation.checkInDate - block.timestamp) / 1 days;

        if (daysUntilCheckIn >= CANCEL_FULL_REFUND_DAYS) {
            return BPS_DENOMINATOR; // 100% refund
        } else if (daysUntilCheckIn >= CANCEL_HALF_REFUND_DAYS) {
            return BPS_DENOMINATOR / 2; // 50% refund
        } else {
            return 0; // No refund
        }
    }

    // ============ Availability Helpers ============

    function _isAvailable(uint256 unitId, uint64 checkInTime, uint64 checkOutTime) internal view returns (bool) {
        uint256 current = _dayTimestamp(checkInTime);
        uint256 end = _dayTimestamp(checkOutTime);

        while (current < end) {
            if (unitOccupied[unitId][current]) {
                return false;
            }
            current += 1 days;
        }
        return true;
    }

    function _markOccupied(uint256 unitId, uint64 checkInTime, uint64 checkOutTime) internal {
        uint256 current = _dayTimestamp(checkInTime);
        uint256 end = _dayTimestamp(checkOutTime);

        while (current < end) {
            unitOccupied[unitId][current] = true;
            current += 1 days;
        }
    }

    function _markAvailable(uint256 unitId, uint64 checkInTime, uint64 checkOutTime) internal {
        uint256 current = _dayTimestamp(checkInTime);
        uint256 end = _dayTimestamp(checkOutTime);

        while (current < end) {
            unitOccupied[unitId][current] = false;
            current += 1 days;
        }
    }

    function _dayTimestamp(uint64 timestamp) internal pure returns (uint256) {
        return (timestamp / 1 days) * 1 days;
    }

    // ============ View Functions ============

    function getUnit(uint256 unitId) external view returns (Unit memory) {
        return units[unitId];
    }

    function getReservation(uint256 reservationId) external view returns (Reservation memory) {
        return reservations[reservationId];
    }

    function isAvailable(uint256 unitId, uint64 checkInTime, uint64 checkOutTime) external view returns (bool) {
        return _isAvailable(unitId, checkInTime, checkOutTime);
    }

    function getInvestorStake(uint256 unitId, address investor) external view returns (uint256) {
        return investorStakes[unitId][investor];
    }
}

