export type AssetKind = "image" | "audio" | "sprite" | "cutscene";

export type R2AssetRef = {
  key: string;
  kind: AssetKind;
  contentType: string;
  sizeBytes: number;
};

export interface R2AssetRepository {
  putAsset(ref: R2AssetRef, body: ArrayBuffer): Promise<void>;
  getPublicUrl(key: string): string;
  createSignedGetUrl(key: string, expiresInSec: number): Promise<string>;
}

export class EnvR2AssetRepository implements R2AssetRepository {
  async putAsset(ref: R2AssetRef, body: ArrayBuffer): Promise<void> {
    void ref;
    void body;
    // MVP skeleton: implement with S3-compatible R2 API later.
  }

  getPublicUrl(key: string): string {
    const base = process.env.R2_PUBLIC_BASE_URL ?? "";
    return `${base.replace(/\/$/, "")}/${key}`;
  }

  async createSignedGetUrl(key: string, expiresInSec: number): Promise<string> {
    void expiresInSec;
    return this.getPublicUrl(key);
  }
}
