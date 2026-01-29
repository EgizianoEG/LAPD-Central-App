import { Collection } from "discord.js";
import Mongoose from "mongoose";

/**
 * A collection class that manages MongoDB documents using a Mongoose model.
 *
 * @template K - The type of the key used to identify documents in the collection.
 * @template T - The type of the document stored in the collection.
 * @template HydratedT - The type of the hydrated Mongoose document, extending `Mongoose.HydratedDocument<T>`.
 *
 * This class extends the base `Collection` class from `discord.js` and provides additional methods
 * for retrieving raw and hydrated documents from the collection.
 *
 * @remarks
 * - The collection stores documents in memory and provides utility methods for
 *   retrieving both plain and hydrated Mongoose documents.
 * - The `Model` property is used to hydrate documents when needed.
 *
 * @example
 * ```typescript
 * const user_collection = new MongoDBDocumentCollection<UserId, User, HydratedUser>(UserModel);
 * const _user = userCollection.getHydrated(userId);
 * ```
 */
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
