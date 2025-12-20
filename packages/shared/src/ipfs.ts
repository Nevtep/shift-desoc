type UploadJsonParams = {
  jwt: string;
  payload: unknown;
  pinataUrl?: string;
};

type UploadResponse = {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
};

export async function uploadJsonToPinata({
  jwt,
  payload,
  pinataUrl = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
}: UploadJsonParams): Promise<string> {
  const response = await fetch(pinataUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata upload failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as UploadResponse;
  return data.IpfsHash;
}

type FetchJsonParams = {
  cid: string;
  gateway?: string;
};

export async function fetchJsonFromIpfs<T = unknown>({
  cid,
  gateway = "https://gateway.pinata.cloud/ipfs/"
}: FetchJsonParams): Promise<T> {
  const url = `${gateway.replace(/\/$/, "")}/${cid}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch IPFS content: ${response.status}`);
  }
  return (await response.json()) as T;
}
