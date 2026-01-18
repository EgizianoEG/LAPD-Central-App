/* eslint-disable sonarjs/no-duplicate-string */
// ---------------------------------------------------------------------------------------
import { UpperFirst, TitleCase, CamelCase, PascalToNormal } from "#Utilities/Strings/Converters.js";
import { DummyText, RandomString } from "#Utilities/Strings/Random.js";
import { faker as Faker } from "@faker-js/faker";
import {
  FormatAge,
  AddStatutes,
  FormatHeight,
  EscapeRegExp,
  FormatCharges,
  UnorderedList,
  FormatUsername,
  FormatVehicleName,
  ListViolationsOrCharges,
} from "#Utilities/Strings/Formatters.js";

import SampleTexts from "#Resources/SampleTexts.js";
import Dedent from "dedent";

// ---------------------------------------------------------------------------------------
// Helpers:
// --------
function RegExpFromCharSet(CharSet: string | RegExp) {
  return typeof CharSet === "string" ? new RegExp(`[${EscapeRegExp(CharSet)}]`) : CharSet;
}

function GetArrayWith<T>(Gen: () => T, ElementCount: number = 10) {
  const Arr: T[] = [];
  for (let i = 0; i < ElementCount; i++) {
    Arr[i] = Gen();
  }
  return Arr;
}

// ---------------------------------------------------------------------------------------
// String Conversion:
// ------------------
describe("String Conversion Utilities", () => {
  describe("Conversion:UpperFirst()", () => {
    it("Should handle an empty string input (return the same)", () => {
      expect(TitleCase("")).toEqual("");
    });

    it("Should handle strings with unicode characters (return as it)", () => {
      expect(UpperFirst("한글")).toEqual("한글");
      expect(UpperFirst("你好")).toEqual("你好");
      expect(UpperFirst("日本語")).toEqual("日本語");
    });

    it("Should capitalize the first letter of a string with basic ASCII characters and lowercase the rest", () => {
      expect(UpperFirst("a")).toEqual("A");
      expect(UpperFirst("HELLO")).toEqual("Hello");
      expect(UpperFirst("hello")).toEqual("Hello");
      expect(UpperFirst("1. Item")).toEqual("1. item");
      expect(UpperFirst("hello, World!")).toEqual("Hello, world!");
      expect(UpperFirst("#1 item\n - UNORDERED")).toEqual("#1 item\n - unordered");
    });
  });

  describe("Conversion:CamelCase()", () => {
    it("Should handle an empty string input (return the same)", () => {
      expect(CamelCase("")).toEqual("");
    });

    it("Should handle and ignore strings of only whitespace and/or special characters", () => {
      expect(CamelCase("#@$@#%@---")).toEqual("#@$@#%@---");
      expect(CamelCase("\n\b^*&*#@!!")).toEqual("\n\b^*&*#@!!");
    });

    it("Should handle strings with unicode characters (return as it)", () => {
      expect(CamelCase("한글")).toEqual("한글");
      expect(CamelCase("你好")).toEqual("你好");
      expect(CamelCase("日本語")).toEqual("日本語");
    });

    it("Should handle single character strings", () => {
      expect(CamelCase("A")).toBe("a");
      expect(CamelCase("b")).toBe("b");
      expect(CamelCase("100")).toBe("100");
    });

    it("Should convert PascalCase string to camel case format", () => {
      expect(CamelCase("PascalCaseString")).toBe("pascalCaseString");
      expect(CamelCase("PascalWith10Digits")).toBe("pascalWith10Digits");
    });

    it("Should convert and handle strings with leading and trailing whitespace and special characters", () => {
      expect(CamelCase("  Whitespace Chars    ")).toBe("whitespaceChars");
      expect(CamelCase("__FooBar__-")).toBe("fooBar");
    });

    it("Should convert and handle basic and complex strings with various formats", () => {
      expect(CamelCase("$Var_1")).toBe("$var1");
      expect(CamelCase("FooBAR")).toBe("fooBAR");
      expect(CamelCase("ERROR404")).toBe("error404");
      expect(CamelCase("FOO_BAR50")).toBe("fooBar50");
      expect(CamelCase("--foo-bar--")).toBe("fooBar");
      expect(CamelCase("Auto_Comp_42")).toBe("autoComp42");
      expect(CamelCase("dot.case.string")).toBe("dotCaseString");
      expect(CamelCase("Thirty4auto5Var")).toBe("thirty4Auto5Var");
      expect(CamelCase("kebab-case-string")).toBe("kebabCaseString");
      expect(CamelCase("this is a sentence")).toBe("thisIsASentence");
      expect(CamelCase("special_characters!@#$%^&*()")).toBe("specialCharacters");
      expect(CamelCase("$Done_45_and_go#$&^*^&*@#$@#$@#$&*^&(&*ing")).toBe("$done45AndGoIng");
    });
  });

  describe("Conversion:PascalToNormal()", () => {
    it("Should handle an empty string input (return the same)", () => {
      expect(PascalToNormal("")).toEqual("");
    });

    it("Should handle a string with only whitespace characters by returning an empty one", () => {
      expect(PascalToNormal("    \n\r \t")).toEqual("");
    });

    it("Should handle string with leading and trailing spaces", () => {
      expect(PascalToNormal("  PascalCaseString  ")).toEqual("Pascal Case String");
    });

    it("Should handle single character strings", () => {
      expect(PascalToNormal("a")).toEqual("a");
      expect(PascalToNormal("A")).toEqual("A");
      expect(PascalToNormal("100")).toEqual("100");
    });

    it("Should convert PascalCase string to normal sentence case", () => {
      expect(PascalToNormal("AutoComp")).toEqual("Auto Comp");
      expect(PascalToNormal("UserRole5")).toEqual("User Role5");
      expect(PascalToNormal("Manage Roles")).toEqual("Manage Roles");
      expect(PascalToNormal("UseApplicationCommands")).toEqual("Use Application Commands");
      expect(PascalToNormal("ManageEmojisAndStickers")).toEqual("Manage Emojis And Stickers");
      expect(PascalToNormal("ViewCreatorMonetizationAnalytics")).toEqual(
        "View Creator Monetization Analytics"
      );
    });
  });

  describe("Conversion:TitleCase()", () => {
    it("Should handle an empty string input (return the same)", () => {
      expect(TitleCase("")).toEqual("");
    });

    it("Should handle a string with only whitespace characters (return the same)", () => {
      expect(TitleCase("    \n\r \t")).toEqual("    \n\r \t");
    });

    it("Should properly convert basic strings to title case format", () => {
      expect(TitleCase(" hello.")).toEqual(" Hello.");
      expect(TitleCase("hello, world of the earth!")).toEqual("Hello, World of the Earth!");
      expect(TitleCase("a withdrawal of funds occurred.")).toEqual(
        "A Withdrawal of Funds Occurred."
      );
    });

    it("Should properly convert mixed case strings to title case", () => {
      expect(TitleCase(" HELLO EVERYBODY!")).toEqual(" Hello Everybody!");
      expect(TitleCase("A wOrLD oF MYsteRIES AS USUAL?!")).toEqual(
        "A World of Mysteries as Usual?!"
      );
    });

    it("Should only keep the letter 'x' lowered if it is used as a counter", () => {
      expect(TitleCase("testing X3")).toEqual("Testing x3");
      expect(TitleCase("This is a test of XXXX3")).toEqual("This Is a Test of Xxxx3");
      expect(TitleCase("'x' is a letter of the latin alphabet")).toEqual(
        "'X' Is a Letter of the Latin Alphabet"
      );
      expect(TitleCase("x8 is the ToTal number we'VE goT")).toEqual(
        "x8 Is the Total Number We've Got"
      );
    });

    it("Should respect the `Strict` parameter if exclusively provided", () => {
      expect(TitleCase("abc of cba", true)).toEqual("Abc of Cba");
      expect(TitleCase("abc of cba", false)).toEqual("Abc Of Cba");
      expect(TitleCase("hello, world of the earth!", false)).toEqual("Hello, World Of The Earth!");
    });

    it("Should handle strings with acronyms and words that should be always capitalized (when Strict is `true`)", () => {
      expect(TitleCase("lapd central bot")).toEqual("LAPD Central Bot");
      expect(TitleCase("atm (at the moment), he is charged with adw by the LaSd.")).toEqual(
        "ATM (at the Moment), He Is Charged with ADW by the LASD."
      );
    });

    it("Should handle strings with words that should be always lowered (when Strict is `true`)", () => {
      expect(TitleCase("run on that track as fast as you can for at least 1 minute.")).toEqual(
        "Run on That Track as Fast as You Can for at Least 1 Minute."
      );
    });

    it("Should handle multiline strings without any issue or loss to the original string", () => {
      const Input = `\n\rwe have the following items:
      1. item num-one
      2. item num-two
        - item num-two-1 (tRieS X3)`;
      const ExpectedOutput = `\n\rWe Have the Following Items:
      1. Item Num-One
      2. Item Num-Two
        - Item Num-Two-1 (Tries x3)`;
      expect(TitleCase(Input)).toBe(ExpectedOutput);
    });
  });
});

// ---------------------------------------------------------------------------------------
// String Randomizing:
// -------------------
describe("String Randomizing Utilities", () => {
  describe("Random:RandomString()", () => {
    const DefaultStringLength = 10;
    const DefaultCharSetReg = /\w/;
    const RandomLengths = GetArrayWith(Faker.number.int.bind(this, { min: 1, max: 100 }), 15);
    const RandomCharSets = [
      /\w/,
      /\d/,
      /\D/,
      /[A-Z]/,
      /[!@#$%^&*()]/,
      "0123456789",
      "somebody123",
      "abcdefghijklmnopqrstuvwxyz",
      "0123456789abcdefghijklmnopqrst",
    ];

    it("Should return an empty string when the length parameter is negative or zero", () => {
      expect(RandomString(0)).toHaveLength(0);
      expect(RandomString(-10)).toHaveLength(0);
      expect(RandomString(-27)).toHaveLength(0);
    });

    it("Should generate a random string using the default function parameters", () => {
      const Result = RandomString();
      expect(Result).toHaveLength(DefaultStringLength);
      expect(DefaultCharSetReg.test(Result)).toBe(true);
    });

    it("Should generate a random string using the default character set and varying lengths", () => {
      RandomLengths.forEach((Length) => {
        const Result = RandomString(Length);
        expect(Result).toHaveLength(Length);
        expect(DefaultCharSetReg.test(Result)).toBe(true);
      });
    });

    it("Should generate a random string using a given character set and the default length", () => {
      RandomCharSets.forEach((CharSet) => {
        const Result = RandomString(undefined, CharSet);
        const CharSetRegex = RegExpFromCharSet(CharSet);
        expect(Result.length).toBeLessThanOrEqual(DefaultStringLength);
        expect(CharSetRegex.test(Result)).toBe(true);
      });
    });

    it("Should return an empty string if CharSet parameter is an empty string or equivalent to an empty RegExp", () => {
      const CharSetReg_1 = RegExpFromCharSet("");
      const CharSetReg_2 = RegExpFromCharSet("");
      const Result_1 = RandomString(undefined, "");
      const Result_2 = RandomString(undefined, CharSetReg_2);
      expect(Result_1).toHaveLength(0);
      expect(Result_2).toHaveLength(0);
      expect(CharSetReg_1.test(Result_1)).toBe(false);
      expect(CharSetReg_2.test(Result_2)).toBe(false);
    });

    it("Should generate a random string given length and character set parameters", () => {
      const ECount = 6;
      const Lengths = Faker.helpers.arrayElements(RandomLengths, ECount);
      const CharSets = Faker.helpers.arrayElements(RandomCharSets, ECount);

      for (let i = 0; i < ECount; i++) {
        const Length = Lengths[i];
        const CharSet = CharSets[i];
        const Result = RandomString(Length, CharSet);
        const CharSetRegex = RegExpFromCharSet(CharSet);
        expect(Result).toHaveLength(Length);
        expect(CharSetRegex.test(Result)).toBe(true);
      }
    });
  });

  describe("Random:DummyText()", () => {
    it("Should return a string", () => {
      expect(typeof DummyText()).toBe("string");
    });

    it("Should return a non-empty string", () => {
      expect(DummyText().length).toBeGreaterThan(0);
    });

    it("Should return a string of 7-12 words separated by spaces", () => {
      const Words = DummyText().split(" ");
      expect(Words.length).toBeGreaterThanOrEqual(7);
      expect(Words.length).toBeLessThanOrEqual(12);
    });

    it("Should return a string from the pre-defined sample texts array", () => {
      expect(SampleTexts.includes(DummyText())).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------------------
// String Formatting:
// ------------------
describe("String Formatting Utilities", () => {
  describe("Formatting:FormatAge()", () => {
    it("Should accept and process string and numeric inputs in the same manner", () => {
      expect(FormatAge("3")).toEqual(FormatAge(3));
      expect(FormatAge("5")).toEqual(FormatAge(5));
    });

    it("Should return `[Unknown]` for unknown inputs", () => {
      expect(FormatAge(6)).toEqual("[Unknown]");
      expect(FormatAge("0")).toEqual("[Unknown]");
    });

    it("Should return a human-readable string indicating the age category/range (Roblox ER:LC)", () => {
      expect(FormatAge(1)).toBe("Kid (<13)");
      expect(FormatAge(2)).toBe("Teen (13-19)");
      expect(FormatAge(3)).toBe("Young Adult (20-29)");
      expect(FormatAge(4)).toBe("Mid Adult (30-49)");
      expect(FormatAge(5)).toBe("Senior (50+)");
    });
  });

  describe("Formatting:FormatHeight()", () => {
    it("Should handle an empty string input (return the same)", () => {
      expect(FormatHeight("")).toBe("");
    });

    it("Should return the input height if it is already properly formatted", () => {
      expect(FormatHeight("5'8\"")).toBe("5'8\"");
      expect(FormatHeight("7'11\"")).toBe("7'11\"");
    });

    it("Should only trim and return the input if it fixes the input height", () => {
      expect(FormatHeight(" 6'0\"   ")).toBe("6'0\"");
      expect(FormatHeight("   7'2\"")).toBe("7'2\"");
    });

    it("Should return the maximum height value if the input is already formatted but greater than or equal to it", () => {
      expect(FormatHeight("8'0\"")).toBe("7'11\"");
      expect(FormatHeight("41'2\"")).toBe("7'11\"");
    });

    it("Should disregard and return strings that are unrelated to height formats", () => {
      expect(FormatHeight("6'1\"2")).toBe("6'1\"2");
      expect(FormatHeight("abc adf")).toBe("abc adf");
      expect(FormatHeight("ER: 4'x7x")).toBe("ER: 4'x7x");
    });

    it("Should properly handle and format height inputs of different formats", () => {
      expect(FormatHeight("6 ft 1 in")).toBe("6'1\"");
      expect(FormatHeight("7    ft and 6 in ")).toBe("7'6\"");
      expect(FormatHeight("5 feet 11 inches")).toBe("5'11\"");
      expect(FormatHeight("4 fet and 9 inches")).toBe("4'9\"");
      expect(FormatHeight("7 feet and 11 inches")).toBe("7'11\"");
    });

    it("Should properly format incomplete or mistyped input heights", () => {
      // Testing if the input is an integer
      expect(FormatHeight("6")).toBe("6'0\"");
      expect(FormatHeight("7")).toBe("7'0\"");

      // Testing if the input is in the format of "X'"
      expect(FormatHeight("6'")).toBe("6'0\"");
      expect(FormatHeight("7'")).toBe("7'0\"");

      // Testing if the input is in the format of "X'Y"
      expect(FormatHeight("6'1")).toBe("6'1\"");
      expect(FormatHeight("7'11")).toBe("7'11\"");
    });
  });

  describe("Formatting:FormatUsername()", () => {
    const InputUserData = {
      name: "builderman_spec",
      display_name: "Builderman",
      id: 25041404840,
    };

    it("Should return formatted string without ID when IncludeID is `false` or `undefined` (default behavior)", () => {
      expect(FormatUsername(InputUserData)).toBe("Builderman (@builderman_spec)");
      expect(FormatUsername(InputUserData, false)).toBe("Builderman (@builderman_spec)");
      expect(FormatUsername(InputUserData, undefined)).toBe("Builderman (@builderman_spec)");
    });

    it("Should return the string '[invalid]' if there was no name field in the input object or if it was an empty string", () => {
      expect(FormatUsername({ name: "", display_name: "Builder" })).toBe("[invalid]");
    });

    it("Should return the formatted string without ID if the ID field is not specified or a falsy value even if the IncludeID is `true`", () => {
      expect(FormatUsername({ name: InputUserData.name, display_name: "Builder" }, true)).toBe(
        "Builder (@builderman_spec)"
      );
    });

    it("Should return formatted string with ID when IncludeId parameter is `true`", () => {
      expect(FormatUsername(InputUserData, true)).toBe(
        "Builderman (@builderman_spec) [25041404840]"
      );
    });

    it("Should return formatted username which is also linked (using markdown) to the user's Roblox profile if UsernameLinked parameter is `true`", () => {
      expect(FormatUsername(InputUserData, false, true)).toBe(
        "Builderman ([@builderman_spec](https://www.roblox.com/users/25041404840/profile))"
      );
    });

    it("Should return formatted string with the username regarded as the display name if display name is not specified", () => {
      InputUserData.display_name = undefined as any;
      expect(FormatUsername(InputUserData)).toBe("builderman_spec (@builderman_spec)");
    });
  });

  describe("Formatting:FormatVehicleName()", () => {
    it("Should handle empty strings for all input values and return an empty string", () => {
      const Model = {
        model_year: { org: "", alt: "" },
        name: "",
        alias: "",
      };

      const Brand = {
        name: "",
        alias: "",
      };

      const Result = FormatVehicleName(Model, Brand);
      expect(Result).toBe("");
    });

    it("Should handle empty strings for some input values", () => {
      const Model = {
        model_year: { org: "2022", alt: "2021" },
        name: "A-100",
        alias: "F-150",
      };

      const Brand = {
        name: "",
        alias: "",
      };

      const Result = FormatVehicleName(Model, Brand);
      expect(Result).toBe("2022 A-100 (2021 F-150)");
    });

    it("Should return a formatted vehicle name with all the information provided", () => {
      const Model = {
        model_year: { org: "2022", alt: "2021" },
        name: "A-100",
        alias: "F-150",
      };

      const Brand = {
        name: "Brand-X",
        alias: "BX",
      };

      const Result = FormatVehicleName(Model, Brand);
      expect(Result).toBe("2022 Brand-X A-100 (2021 BX F-150)");
    });
  });

  describe("Formatting:UnorderedList()", () => {
    it("Should handle empty input and return the value as is", () => {
      const Input = "";
      const ExpectedOutput = "";
      expect(UnorderedList(Input)).toBe(ExpectedOutput);
    });

    it("Should handle empty array input and return an empty string", () => {
      const Input = [];
      const ExpectedOutput = "";
      expect(UnorderedList(Input)).toBe(ExpectedOutput);
    });

    it("Should convert a multiline string into an unordered list", () => {
      const Input = Dedent`
      Line 1
        Line 1-1
        Line 1-2
      Line 3`;
      const ExpectedOutput = Dedent`
      - Line 1
      -   Line 1-1
      -   Line 1-2
      - Line 3`;
      expect(UnorderedList(Input)).toBe(ExpectedOutput);
    });

    it("Should convert an array of lines into an unordered list", () => {
      const Input = ["Line 1", "Line 2", "Line 3"];
      const ExpectedOutput = "- Line 1\n- Line 2\n- Line 3";
      expect(UnorderedList(Input)).toBe(ExpectedOutput);
    });
  });

  describe("Formatting:FormatCharges()", () => {
    it("Should convert a multiline string of unformatted charges into a formal formatted and numbered list of charges", () => {
      const Input = Dedent`\
      Resisting a peace officer
      Evading a peace officer: Disregarding Safety\
      `;

      const ExpectedOutput = Dedent`\
      1. Resisting a Peace Officer
        Statute: § 69(A)/148(A) PC
      2. Evading a Peace Officer: Disregarding Safety
        Statute: § 2800.2(A) VC\
      `;

      const Result = FormatCharges(Input).join("\n");
      expect(Result).toBe(ExpectedOutput);
    });
  });

  describe("Formatting:ListCharges()", () => {
    it("Should return an empty string/array if input is considered an empty string", () => {
      expect(ListViolationsOrCharges("", true, true)).toEqual([]);
      expect(ListViolationsOrCharges("", false, false)).toEqual("");
      expect(ListViolationsOrCharges(" \n\r \t  ", true, true)).toEqual([]);
      expect(ListViolationsOrCharges(" \n\r \t  ", undefined, false)).toEqual("");
    });

    it("Should omit any numbering or listing characters from the multiline input of unformatted charges and properly renumber them", () => {
      const Input_1 = "- A charge \r\n * A second charge ";
      const ExpectedOutput_1 = "1. A charge\n2. A second charge";
      expect(ListViolationsOrCharges(Input_1, true, false)).toBe(ExpectedOutput_1);

      const Input_2 = "  4. First numbered item\n10. Second numbered item";
      const ExpectedOutput_2 = "1. First numbered item\n2. Second numbered item";
      expect(ListViolationsOrCharges(Input_2, undefined, false)).toBe(ExpectedOutput_2);
    });

    it("Should omit any lines that represents legal statute codes from the multiline input of unformatted charges and return normally", () => {
      const Input_1 =
        "Charge (1)\n  - Statute: x2\n\rCharge (2)\n  * Statute 3\r\nCharge (3)\n  - statute 4\nCharge (4)";
      const ExpectedOutput_1 = "1. Charge (1)\n2. Charge (2)\n3. Charge (3)\n4. Charge (4)";
      expect(ListViolationsOrCharges(Input_1, undefined, false)).toBe(ExpectedOutput_1);

      const Input_2 = "\r\n\n   1. Evasion of Peace Officer \n  - Statute: xxxxx (x)";
      const ExpectedOutput_2 = "1. Evasion of Peace Officer";
      expect(ListViolationsOrCharges(Input_2, undefined, false)).toBe(ExpectedOutput_2);
    });
    it("Should format a multiline input string into a formatted numbered list of charges or an array", () => {});
  });

  describe("Formatting:AddStatutes()", () => {
    it("Should assign the proper statute codes to resisting charge with various formats", () => {
      const Inputs = [
        "Failure to Comply with a peace officer",
        "#1 resisting a LEO",
        "Obstruction of justice",
        "4. not listening to PO",
        "5. Interfering with police",
      ];

      Inputs.forEach((CAlias) => {
        const Result = AddStatutes([CAlias]);
        expect(Result.toString()).toMatch(/69\(\w\)|148\(\w\)|69\(\w\)\/148\(\w\)/i);
      });
    });

    it("Should return the input array if it has only one element which is suspected to have more than one charge", () => {
      const Inputs = [
        "evasion, resisting, and assault",
        "attempt robbery and murder",
        "Trespassing and theft",
      ];

      expect(AddStatutes(["Hit and Run"]).toString()).not.toMatch(/^Hit and Run$/);
      Inputs.forEach((CAlias) => {
        const Result = AddStatutes([CAlias]);
        expect(Result.toString()).toMatch(CAlias);
      });
    });

    it("Should assign the proper statute codes to battery charges with various formats", () => {
      const Inputs = [
        "Battery on a LEO",
        "Civilian Battery",
        "Battery on a civilian",
        "Battary on a peace officer",
      ];

      Inputs.forEach((CAlias) => {
        const Result = AddStatutes([CAlias]);
        expect(Result.toString()).toMatch(/\n\s*Statute:.*?(?:242|243\(\w\))/i);
      });
    });

    it("Should assign the proper statute codes to assault charges with various formats", () => {
      const Inputs = [
        "ADW on a LEO",
        "ADW - Not A Gun",
        "Stabbing a civilian",
        "Assaulted PO: F/ARM",
        "3. Assualted a protester",
        "Assaulting a Peace Officer",
        "ADW on an officer: Other than a gun",
        "Assaulting a LEO: w/ a Deadly Weapon",
        "7. Assaulting a civilian with a deadly weapon",
        "Assault with a Deadly Weapon: Other than a Firearm",
      ];

      Inputs.forEach((CAlias) => {
        const Result = AddStatutes([CAlias]);
        expect(Result.toString()).toMatch(
          /\n\s*Statute:.*?(?:240|245\(\w\)|245\(\w\)\(1\)|240\/241\(\w\))/i
        );
      });
    });

    it("Should assign the proper statute codes to evasion charges with various formats", () => {
      const Inputs = [
        "Evading",
        "1. Evasion",
        "3. Vehicle evasion",
        "3. Vehicle fleeing",
        "Evasion: Disregarding Safety",
        "Eluding a peace officer",
        "Evading Law Enforcement",
        "Running from LEO",
        ["1. Vehicle Evasion", "2. Reckless Driving"],
        ["4. Fleeing an Officer", "3. Traffic Crimes"],
      ];

      Inputs.forEach((CAlias) => {
        const Result = AddStatutes(Array.isArray(CAlias) ? CAlias : [CAlias]);
        expect(Result.toString()).toMatch(/\n\s*Statute:.*?(?:2800.2\(A\)|2800)/i);
      });
    });

    it("Should assign the proper statute codes to fire-related crimes (Arson) of different formats", () => {
      const Inputs = [
        "Incendiarism",
        "#4 Fire raising",
        "- Burning a public place.",
        "Fire-setting of a building",
        ["1. Murder", "2. Arsen"],
      ];

      Inputs.forEach((CAlias) => {
        const Result = AddStatutes(Array.isArray(CAlias) ? CAlias : [CAlias]);
        expect(Result.toString()).toMatch(/\n\s*Statute:.*?(?:451)/i);
      });
    });

    it("Should handle and properly assign the law statute codes to an array of various charges", () => {
      const Inputs = [
        [
          "1. Vehicle Evasion",
          "2. Possession of burglary tools",
          "3. Reckless Driving",
          "4. Accessory after the fact",
        ],
        [
          "1. House robbery",
          "2. Shooting at police vehicles",
          "3. Resisting an Arrest",
          "4. Grand Theft: Jewelry Robbery",
        ],
      ];

      Inputs.forEach((CAlias) => {
        const Org = [...CAlias];
        const Result = AddStatutes(Array.isArray(CAlias) ? CAlias : [CAlias]);

        // eslint-disable-next-line sonarjs/no-nested-functions
        Result.forEach((Charge, i) =>
          expect(Charge).toMatch(new RegExp(`^${Org[i]}\\n\\s*Statute:`))
        );
      });
    });
  });
});
