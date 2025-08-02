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

export const DASignatureFormat = {
  DiscordNickname: 0,
  DiscordUsername: 0,
  RobloxUsername: 0,
  RobloxDisplayName: 0,
  DiscordNicknameRobloxUsername: 0,
  DiscordNicknameDiscordUsername: 0,
  RobloxDisplayNameRobloxUsername: 0,
};

export const SignatureFormatResolved = {
  [DASignatureFormat.DiscordNickname]: "Discord Nickname",
  [DASignatureFormat.DiscordUsername]: "Discord Username",
  [DASignatureFormat.RobloxUsername]: "Roblox Username",
  [DASignatureFormat.RobloxDisplayName]: "Roblox Display Name",
  [DASignatureFormat.DiscordNicknameRobloxUsername]: "Discord Nickname + Roblox Username",
  [DASignatureFormat.DiscordNicknameDiscordUsername]: "Discord Nickname + Discord Username",
  [DASignatureFormat.RobloxDisplayNameRobloxUsername]: "Roblox Display Name + Roblox Username",
};
