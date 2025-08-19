import { Collection } from "discord.js";
import Mongoose from "mongoose";

export default class MongoDBDocumentCollection<
  K,
  T,
  HydratedT extends Mongoose.HydratedDocument<T> = Mongoose.HydratedDocument<T>,
> extends Collection<K, T> {
  private readonly Model: Mongoose.Model<T>;

  constructor(model: Mongoose.Model<T>);
  constructor(model: Mongoose.Model<T>, entries?: readonly (readonly [K, T])[] | null);
  constructor(model: Mongoose.Model<T>, iterable?: Iterable<readonly [K, T]>);
  constructor(
    model: Mongoose.Model<T>,
    entriesOrIterable?: readonly (readonly [K, T])[] | Iterable<readonly [K, T]> | null
  ) {
    super(entriesOrIterable as any);
    this.Model = model;
  }

  /**
   * Retrieves a document from the collection by its key.
   * The key difference is that it returns a deeply cloned version of the document instead of a reference.
   * @param key - The key of the document to retrieve.
   * @alias get - This method is an alias for `get`.
   * @returns The document if found, otherwise `undefined`.
   */
  public getRaw(key: K): T | undefined {
    return structuredClone(this.get(key));
  }

  /**
   * Retrieves a hydrated document from the collection by its key.
   * @param key - The key of the document to retrieve.
   * @returns A hydrated instance of the document if found, otherwise `undefined`.
   */
  public getHydrated(key: K): HydratedT | undefined {
    const Doc = this.get(key);
    if (Doc) {
      const DocumentInst = new this.Model(structuredClone(Doc));
      DocumentInst.isNew = false;
      return DocumentInst as HydratedT;
    }
    return Doc as HydratedT | undefined;
  }
}
