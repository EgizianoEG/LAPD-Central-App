import Shuffle from "@Utilities/Helpers/ShuffleArray.js";

describe("ShuffleArray()", () => {
  it("Should shuffle an array of elements", () => {
    const Arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ShuffledArr = Shuffle([...Arr]);
    expect(ShuffledArr).not.toEqual(Arr);
    expect(ShuffledArr.toSorted((a, b) => a - b)).toEqual(Arr.toSorted((a, b) => a - b));
  });

  it("Should return the same array if it has only one element", () => {
    const Arr = [1];
    const ShuffledArr = Shuffle([...Arr]);
    expect(ShuffledArr).toEqual(Arr);
  });

  it("Should return an empty array if the input array is empty", () => {
    const Arr = [];
    const ShuffledArr = Shuffle([...Arr]);
    expect(ShuffledArr).toEqual(Arr);
  });
});
