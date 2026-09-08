import { describe, expect, it } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAbiItem,
  zeroAddress,
  type AbiEvent,
  type AbiParameter,
} from "viem";

import { CONTRACTS } from "../../../../lib/contracts";
import { extractCreatedActionIdFromReceipt } from "../../../../lib/valuable-actions/created-action-id";

const createdEvent = getAbiItem({
  abi: CONTRACTS.valuableActionRegistry.abi,
  name: "ValuableActionCreated",
}) as AbiEvent;

function defaultAbiValue(param: AbiParameter): unknown {
  if (param.type === "tuple" && "components" in param) {
    return Object.fromEntries(param.components.map((component) => [component.name, defaultAbiValue(component)]));
  }
  if (param.type.endsWith("[]")) return [];
  if (param.type.startsWith("uint") || param.type.startsWith("int")) return 0n;
  if (param.type === "bool") return false;
  if (param.type === "address") return zeroAddress;
  if (param.type === "string") return "";
  if (param.type.startsWith("bytes")) return `0x${"00".repeat(32)}`;
  throw new Error(`Unsupported ABI type in test fixture: ${param.type}`);
}

function buildValuableActionCreatedLog(id: bigint) {
  const topics = encodeEventTopics({
    abi: [createdEvent],
    eventName: "ValuableActionCreated",
    args: { id, creator: zeroAddress },
  });
  const nonIndexedInputs = createdEvent.inputs.filter((input) => !input.indexed);
  const data = encodeAbiParameters(nonIndexedInputs, nonIndexedInputs.map(defaultAbiValue));

  return { address: zeroAddress, topics, data };
}

describe("extractCreatedActionIdFromReceipt", () => {
  it("returns the action id when the ValuableActionCreated event is present", () => {
    const receipt = { logs: [buildValuableActionCreatedLog(42n)] };

    expect(extractCreatedActionIdFromReceipt(receipt)).toBe(42);
  });

  it("returns null when the event is absent from the receipt logs", () => {
    expect(extractCreatedActionIdFromReceipt({ logs: [] })).toBeNull();
    expect(extractCreatedActionIdFromReceipt({})).toBeNull();
    expect(extractCreatedActionIdFromReceipt(null)).toBeNull();
  });

  it("fails closed to null on malformed or undecodable logs", () => {
    const [topic0] = encodeEventTopics({ abi: [createdEvent], eventName: "ValuableActionCreated" });

    expect(
      extractCreatedActionIdFromReceipt({
        logs: [{ address: zeroAddress, topics: [topic0], data: "0x1234" }],
      })
    ).toBeNull();
    expect(extractCreatedActionIdFromReceipt({ logs: [{}] })).toBeNull();
    expect(extractCreatedActionIdFromReceipt({ logs: "not-logs" })).toBeNull();
  });
});
