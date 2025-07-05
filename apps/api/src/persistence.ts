export type DocumentObjectModel = {
  textDocLogBuffer?: string;
  latestCanvasSnapshot?: string;
};

export interface DocumentStorage {
  getState(): Promise<DocumentObjectModel | null>;
  putState(state: DocumentObjectModel): Promise<void>;
  getId(): Promise<string | null>;
  setId(id: string): Promise<void>;
}

export class DObjectStorage implements DocumentStorage {
  constructor(private storage: DurableObjectStorage) {}

  async getState(): Promise<DocumentObjectModel | null> {
    const savedState = (await this.storage.get("state")) as string | null;
    return savedState ? (JSON.parse(savedState) as DocumentObjectModel) : null;
  }

  async putState(state: DocumentObjectModel): Promise<void> {
    await this.storage.put("state", JSON.stringify(state));
  }

  async getId(): Promise<string | null> {
    return (await this.storage.get("id")) as string | null;
  }

  async setId(id: string): Promise<void> {
    await this.storage.put("id", id);
  }
}

export class D1Storage {
  constructor(private db: D1Database, private documentId: string) {}

  async loadState(): Promise<DocumentObjectModel | null> {
    if (!this.documentId) {
      return null;
    }
    try {
      const row = await this.db
        .prepare("SELECT state FROM documents WHERE document_id = ?")
        .bind(this.documentId)
        .first<{ state: string }>();

      return row && row.state
        ? (JSON.parse(row.state) as DocumentObjectModel)
        : null;
    } catch (err) {
      return null;
    }
  }

  async storeState(state: DocumentObjectModel): Promise<void> {
    if (!this.documentId) {
      return;
    }
    try {
      await this.db
        .prepare(
          "INSERT INTO documents (document_id, state) VALUES (?, ?) ON CONFLICT(document_id) DO UPDATE SET state = ?"
        )
        .bind(this.documentId, JSON.stringify(state), JSON.stringify(state))
        .run();
    } catch (err) {}
  }
}
