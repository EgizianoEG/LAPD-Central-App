/**
 * Checks if two arrays are equal by comparing their lengths and sorted string representations.
 * @param Arr_1 - An array of any type, denoted as `Arr_1`.
 * @param Arr_2 - An array of any type.
 * @returns a boolean value, indicating whether the two input arrays are equal or not, ***disregarding their element order***.
 */
export function ArraysAreEqual(Arr_1: Array<any>, Arr_2: Array<any>): boolean {
  if (Arr_1 === Arr_2) return true;
  if (Arr_1 == null || Arr_2 == null) return false;
  if (Arr_1.length !== Arr_2.length) return false;

  const Sorted_1 = Arr_1.toSorted((a, b) => a - b);
  const Sorted_2 = Arr_2.toSorted((a, b) => a - b);

  for (let i = 0; i < Sorted_1.length; ++i) {
    if (Sorted_1[i] !== Sorted_2[i]) return false;
  }

  return true;
}
