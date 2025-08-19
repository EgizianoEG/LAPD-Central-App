/**
 * Returns a new array with the original array divided into smaller chunks.
 * @param Arr - The array to slice into chunks.
 * @param ChunkSize - The preferred chunk size.
 * @returns A result array.
 */
export default function Chunks<T>(Arr: Array<T>, ChunkSize: number) {
  ChunkSize = ChunkSize || Infinity;
  return Arr.reduce(
    (Result, Item, Index) => {
      const ChunkIndex = Math.floor(Index / ChunkSize);

      if (!Result[ChunkIndex]) {
        Result[ChunkIndex] = [];
      }

      Result[ChunkIndex].push(Item);
      return Result;
    },
    [] as Array<Array<T>>
  );
}
