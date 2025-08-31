import { PermissionFlagsBits } from "discord.js";

export const RiskyRolePermissions = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ViewAuditLog,
  PermissionFlagsBits.ManageEvents,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.ManageGuildExpressions,
];

export const DASignatureFormats = {
  DiscordNickname: 1 << 0,
  DiscordUsername: 1 << 1,
  RobloxUsername: 1 << 2,
  RobloxDisplayName: 1 << 3,
  DiscordNicknameRobloxUsername: (1 << 0) | (1 << 2),
  DiscordNicknameDiscordUsername: (1 << 0) | (1 << 1),
  RobloxDisplayNameRobloxUsername: (1 << 3) | (1 << 2),
};

export const SignatureFormatResolved = {
  [DASignatureFormats.DiscordNickname]: "Discord Nickname",
  [DASignatureFormats.DiscordUsername]: "Discord Username",
  [DASignatureFormats.RobloxUsername]: "Roblox Username",
  [DASignatureFormats.RobloxDisplayName]: "Roblox Display Name",
  [DASignatureFormats.DiscordNicknameRobloxUsername]: "Discord Nickname + Roblox Username",
  [DASignatureFormats.DiscordNicknameDiscordUsername]: "Discord Nickname + Discord Username",
  [DASignatureFormats.RobloxDisplayNameRobloxUsername]: "Roblox Display Name + Roblox Username",
};

export const GenericRequestStatuses = {
  Pending: "Pending",
  Approved: "Approved",
  Denied: "Denied",
  Cancelled: "Cancelled",
};

export const CallsignUnitTypes = {
  A: "A",
  B: "B",
  C: "C",
  E: "E",
  F: "F",
  G: "G",
  K9: "K9",
  H: "H",
  L: "L",
  M: "M",
  N: "N",
  P: "P",
  R: "R",
  S: "S",
  U: "U",
  T: "T",
  W: "W",
  Y: "Y",
  I: "I",
  K: "K",
  X: "X",
  Z: "Z",
};
