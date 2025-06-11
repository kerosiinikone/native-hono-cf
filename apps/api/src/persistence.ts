import { DocumentState, TextDocumentState } from "@native-hono-cf/shared";

export type DocumentObjectModel = DocumentState & TextDocumentState;

export interface DocumentStorage {
  _getState(): Promise<DocumentObjectModel | null>;
  _putState(state: DocumentObjectModel): Promise<void>;
  _getId(): Promise<string | null>;
  _setId(id: string): Promise<void>;
}

export class DObjectStorage implements DocumentStorage {
  constructor(private storage: DurableObjectStorage) {}

  async _getState(): Promise<DocumentObjectModel | null> {
    const savedState = (await this.storage.get("state")) as string | null;
    return savedState ? (JSON.parse(savedState) as DocumentObjectModel) : null;
  }

  async _putState(state: DocumentObjectModel): Promise<void> {
    await this.storage.put("state", JSON.stringify(state));
  }

  async _getId(): Promise<string | null> {
    return (await this.storage.get("id")) as string | null;
  }

  async _setId(id: string): Promise<void> {
    await this.storage.put("id", id);
  }
}

export class D1Persistence {
  constructor(private db: D1Database, private documentId: string) {}

  async loadState(): Promise<DocumentObjectModel | null> {
    if (!this.documentId) {
      console.error("[D1Persistence] No document ID provided for loadState.");
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
      console.error(
        `[D1Persistence] Error loading state for ${this.documentId}:`,
        err
      );
      return null;
    }
  }

  async persistState(state: DocumentObjectModel): Promise<void> {
    if (!this.documentId) {
      console.error(
        "[D1Persistence] No document ID provided for persistState."
      );
      return;
    }
    if (!state.elements?.length) {
      console.warn(
        `[D1Persistence] No state elements to persist for ${this.documentId}`
      );
      return;
    }
    try {
      await this.db
        .prepare(
          "INSERT INTO documents (document_id, state) VALUES (?, ?) ON CONFLICT(document_id) DO UPDATE SET state = ?"
        )
        .bind(this.documentId, JSON.stringify(state), JSON.stringify(state))
        .run();
    } catch (err) {
      console.error(
        `[D1Persistence] Error persisting state for ${this.documentId}:`,
        err
      );
    }
  }
}
