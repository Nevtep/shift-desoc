import { claimsEntities } from "../schema/claims";
import { communityEntities } from "../schema/community";
import { draftEntities } from "../schema/draft";
import { governanceEntities } from "../schema/governance";
import { marketplaceEntities } from "../schema/marketplace";
import { requestEntities } from "../schema/request";

// Schema registry placeholder consolidating entity definitions until full Ponder setup lands.
export const schema = {
	community: communityEntities,
	request: requestEntities,
	draft: draftEntities,
	governance: governanceEntities,
	claims: claimsEntities,
	marketplace: marketplaceEntities
};
