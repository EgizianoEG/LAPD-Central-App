import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import {
  IsPlainObject,
  IsEmptyObject,
  IsValidShiftId,
  IsValidDiscordId,
  IsValidCmdObject,
  IsValidUserPermsObj,
  IsValidLicensePlate,
  IsValidPersonHeight,
  IsValidShiftTypeName,
  IsValidRobloxUsername,
} from "@Utilities/Helpers/Validators";

describe("IsValidRobloxUsername", () => {
  it("Should return false for strings of less than 3 or more than 20 characters in length", () => {
    expect(IsValidRobloxUsername("")).toBeFalsy();
    expect(IsValidRobloxUsername("UsernameExCom12345678")).toBeFalsy();
  });

  it("Should return false for usernames containing illegal or special characters", () => {
    expect(IsValidRobloxUsername("1&2Roblox-User")).toBeFalsy();
    expect(IsValidRobloxUsername("Roblox Username")).toBeFalsy();
  });

  it("Should return false for usernames with leading, trailing, or multiple in-between underscores", () => {
    expect(IsValidRobloxUsername("__RobloxUser")).toBeFalsy();
    expect(IsValidRobloxUsername("_Builder_Man__")).toBeFalsy();
  });

  it("Should return true for valid Roblox usernames", () => {
    expect(IsValidRobloxUsername("Char")).toBeTruthy();
    expect(IsValidRobloxUsername("admin123")).toBeTruthy();
    expect(IsValidRobloxUsername("54852320")).toBeTruthy();
    expect(IsValidRobloxUsername("Builderman")).toBeTruthy();
    expect(IsValidRobloxUsername("roblox_user50")).toBeTruthy();
    expect(IsValidRobloxUsername("Example_Username")).toBeTruthy();
    expect(IsValidRobloxUsername("OnlyTwentyCharacters")).toBeTruthy();
  });
});

describe("IsValidShiftTypeName", () => {
  it("Should return false for strings of less than 3 or more than 20 characters in length (after trimming)", () => {
    expect(IsValidShiftTypeName("")).toBeFalsy();
    expect(IsValidShiftTypeName("     ")).toBeFalsy();
    expect(IsValidShiftTypeName("NewShiftTypeNoNameYet")).toBeFalsy();
  });

  it("Should return false for invalid shift type names which contain illegal characters", () => {
    expect(IsValidShiftTypeName("#123 Shift")).toBeFalsy();
    expect(IsValidShiftTypeName("Shift @ 9am")).toBeFalsy();
    expect(IsValidShiftTypeName("unknown*shift")).toBeFalsy();
  });

  it("Should return true for valid shift type names", () => {
    expect(IsValidShiftTypeName("Morning")).toBeTruthy();
    expect(IsValidShiftTypeName("On-Call")).toBeTruthy();
    expect(IsValidShiftTypeName("Evening Shift")).toBeTruthy();
    expect(IsValidShiftTypeName("L.A.P.D. Patrol")).toBeTruthy();
    expect(IsValidShiftTypeName("Supervisory_Shift")).toBeTruthy();
  });
});

describe("IsValidCmdObject", () => {
  it("should return false for invalid/empty command objects", () => {
    expect(IsValidCmdObject({ data: {} } as any)).toBeFalsy();
    expect(IsValidCmdObject({ options: {} } as any)).toBeFalsy();
  });

  it("Should return false for command objects with excluded names", () => {
    const Exceptions = ["ping"];
    const CmdObject: SlashCommandObject = {
      callback: () => Promise.resolve(),
      data: new SlashCommandBuilder().setName("ping").setDescription("Pings the bot"),
    };

    expect(IsValidCmdObject(CmdObject, Exceptions)).toBeFalsy();
  });

  it("Should return true for valid slash command objects", () => {
    const CmdObject = {
      options: {},
      callback: () => Promise.resolve(),
      data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Pings the bot")
        .setContexts(InteractionContextType.Guild),
    };

    expect(IsValidCmdObject(CmdObject)).toBeTruthy();
  });
});

describe("IsPlainObject", () => {
  it("Should return true for plain objects", () => {
    expect(IsPlainObject({})).toBeTruthy();
    expect(IsPlainObject({ key: "value" })).toBeTruthy();
    expect(IsPlainObject(new Object())).toBeTruthy();
  });

  it("Should return false for non-plain objects", () => {
    expect(IsPlainObject([])).toBeFalsy();
    expect(IsPlainObject(null)).toBeFalsy();
    expect(IsPlainObject(function () {})).toBeFalsy();
  });
});

describe("IsEmptyObject", () => {
  it("Should return true for empty objects with no defined keys", () => {
    expect(IsEmptyObject({})).toBeTruthy();
    expect(IsEmptyObject(new Object())).toBeTruthy();
  });

  it("Should return false for non-empty objects", () => {
    expect(IsEmptyObject({ key: null })).toBeFalsy();
    expect(IsEmptyObject({ key: undefined as any })).toBeFalsy();
    expect(IsEmptyObject({ key: "value" })).toBeFalsy();
    expect(IsEmptyObject({ a: 1, b: 2 })).toBeFalsy();
    expect(IsEmptyObject([1, 2, 3])).toBeFalsy();
  });
});

describe("IsValidShiftId", () => {
  it("Should return false for shift ids with less than or greater than 15 characters", () => {
    expect(IsValidShiftId("")).toBeFalsy();
    expect(IsValidShiftId("12345")).toBeFalsy();
    expect(IsValidShiftId("12345678901234521")).toBeFalsy();
  });

  it("Should return false for non-numeric shift ids", () => {
    expect(IsValidShiftId("               ")).toBeFalsy();
    expect(IsValidShiftId("abcdabcdacdabcd")).toBeFalsy();
    expect(IsValidShiftId("$#&^$#&^$#&^$#'")).toBeFalsy();
  });

  it("Should return false for invalid shift ids", () => {
    expect(IsValidShiftId("723456789012345")).toBeFalsy();
    expect(IsValidShiftId("179956789012345")).toBeFalsy();
    expect(IsValidShiftId("02345678901234")).toBeFalsy();
    expect(IsValidShiftId("18745678901234")).toBeFalsy();
  });

  it("Should return true for valid shift ids", () => {
    const CurrentTimestamp = new Date().valueOf() - 1_000;
    const ValidShiftId = CurrentTimestamp.toString().padEnd(15, "0");
    expect(IsValidShiftId(ValidShiftId)).toBeTruthy();
  });
});

describe("IsValidPersonHeight", () => {
  it("Should return false for invalid person heights", () => {
    expect(IsValidPersonHeight("")).toBeFalsy();
    expect(IsValidPersonHeight("5'13\"")).toBeFalsy();
    expect(IsValidPersonHeight("6'00\"")).toBeFalsy();
    expect(IsValidPersonHeight("7'13\"")).toBeFalsy();
    expect(IsValidPersonHeight("7'0\"1")).toBeFalsy();
    expect(IsValidPersonHeight("4'01\"1")).toBeFalsy();
    expect(IsValidPersonHeight("7'01\"a")).toBeFalsy();
    expect(IsValidPersonHeight("7'14\" ")).toBeFalsy();
    expect(IsValidPersonHeight('7\'01""')).toBeFalsy();
  });

  it("Should return true for valid person heights", () => {
    expect(IsValidPersonHeight("5'0\"")).toBeTruthy();
    expect(IsValidPersonHeight("5'6\"")).toBeTruthy();
    expect(IsValidPersonHeight("6'2\"")).toBeTruthy();
    expect(IsValidPersonHeight("7'0\"")).toBeTruthy();
    expect(IsValidPersonHeight("7'11\"")).toBeTruthy();
  });
});

describe("IsValidUserPermsObj", () => {
  it("Should return false for invalid user permissions objects", () => {
    expect(IsValidUserPermsObj({})).toBeFalsy();
    expect(IsValidUserPermsObj({ id: "123" })).toBeFalsy();
    expect(IsValidUserPermsObj({ abc: "abc", manage: true })).toBeFalsy();
    expect(IsValidUserPermsObj({ check: { staff: true, management: true } })).toBeFalsy();
  });

  it("Should return true for valid user permissions objects", () => {
    expect(IsValidUserPermsObj({ staff: true })).toBeTruthy();
    expect(IsValidUserPermsObj({ management: true })).toBeTruthy();
    expect(IsValidUserPermsObj({ management: { server: true } })).toBeTruthy();
    expect(IsValidUserPermsObj({ management: { server: true } })).toBeTruthy();
    expect(IsValidUserPermsObj({ staff: true, management: false })).toBeTruthy();

    expect(
      IsValidUserPermsObj({ cmd: { staff: true }, management: { server: true } })
    ).toBeTruthy();

    expect(
      IsValidUserPermsObj({ staff: true, management: { server: true, app: true } })
    ).toBeTruthy();

    expect(
      IsValidUserPermsObj({ staff: true, management: { server: true, app: true, $and: true } })
    ).toBeTruthy();
  });
});

describe("IsValidDiscordId", () => {
  it("Should return false for invalid Discord snowflake ids", () => {
    expect(IsValidDiscordId("")).toBeFalsy();
    expect(IsValidDiscordId("12345")).toBeFalsy();
    expect(IsValidDiscordId("               ")).toBeFalsy();
    expect(IsValidDiscordId("abcdabcdacdabcd")).toBeFalsy();
    expect(IsValidDiscordId("$#&^$#&^$#&^$#'")).toBeFalsy();
    expect(IsValidDiscordId("48002343548678901234")).toBeFalsy();
    expect(IsValidDiscordId("4745858745678901234")).toBeFalsy();
  });

  it("Should return true for valid Discord snowflake ids", () => {
    expect(IsValidDiscordId("123456789012345")).toBeTruthy();
    expect(IsValidDiscordId("987654321098765432")).toBeTruthy();
    expect(IsValidDiscordId("723456789012345")).toBeTruthy();
    expect(IsValidDiscordId("179956789012345")).toBeTruthy();
    expect(IsValidDiscordId("1202001151969742939")).toBeTruthy();
    expect(IsValidDiscordId("1186171894911733841")).toBeTruthy();
  });
});

describe("IsValidLicensePlate", () => {
  it("Should return false for license plates starting or ending with '-'", () => {
    expect(IsValidLicensePlate("-ABC123")).toBeFalsy();
    expect(IsValidLicensePlate("ABC123-")).toBeFalsy();
    expect(IsValidLicensePlate("-ABC123-")).toBeFalsy();
  });

  it("Should return false for license plates with less than 3 or more than 7 characters", () => {
    expect(IsValidLicensePlate("AB")).toBeFalsy();
    expect(IsValidLicensePlate("ABC12345")).toBeFalsy();
  });

  it("Should return false for license plates containing invalid characters", () => {
    expect(IsValidLicensePlate("ABC@123")).toBeFalsy();
    expect(IsValidLicensePlate("ABC_123")).toBeFalsy();
    expect(IsValidLicensePlate("ABC.123")).toBeFalsy();
  });

  it("Should return true for valid license plates", () => {
    expect(IsValidLicensePlate("ABC123")).toBeTruthy();
    expect(IsValidLicensePlate("123")).toBeTruthy();
    expect(IsValidLicensePlate("1234567")).toBeTruthy();
    expect(IsValidLicensePlate("abcdefg")).toBeTruthy();
    expect(IsValidLicensePlate("DEF-456")).toBeTruthy();
    expect(IsValidLicensePlate("GHI-JKL")).toBeTruthy();
    expect(IsValidLicensePlate("123-XYZ")).toBeTruthy();
  });
});
