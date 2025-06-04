/* eslint-disable sonarjs/no-duplicate-string */
jest.mock("@Utilities/Discord/MentionCmd.js", () => {
  return jest.fn((CmdName: string) => `/${CmdName}`);
});

import AppError from "@Utilities/Classes/AppError.js";
import { ErrorMessages, InfoMessages } from "@Resources/AppMessages.js";
import { Colors } from "@Config/Shared.js";
import {
  InfoContainer,
  WarnContainer,
  ErrorContainer,
  SuccessContainer,
  BaseExtraContainer,
  UnauthorizedContainer,
} from "@Utilities/Classes/ExtraContainers.js";

import {
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  RepliableInteraction,
  CommandInteraction,
  TextDisplayBuilder,
  ButtonInteraction,
  ActionRowBuilder,
  ThumbnailBuilder,
  SectionBuilder,
  ButtonBuilder,
  ComponentType,
  MessageFlags,
  resolveColor,
  SeparatorBuilder,
} from "discord.js";

jest.mock("discord.js", () => {
  const Original = jest.requireActual("discord.js");
  return {
    ...Original,
  };
});

type MockInteractionTypes =
  | "MessageComponentInteraction"
  | "ChatInputCommandInteraction"
  | "ButtonInteraction"
  | "CommandInteraction";

function CreateMockInteraction(
  type: MockInteractionTypes,
  options: DeepPartialAllowNull<RepliableInteraction> = {}
) {
  let Mock: RepliableInteraction;
  const BaseMock = {
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    followUp: jest.fn().mockResolvedValue({}),
    message: { flags: { has: jest.fn().mockReturnValue(MessageFlags.IsComponentsV2) } },
    ...options,
  };

  switch (type) {
    case "ButtonInteraction":
      Mock = Object.create(ButtonInteraction.prototype);
      Object.defineProperty(Mock, "constructor", {
        value: ButtonInteraction,
        configurable: true,
      });
      break;

    case "MessageComponentInteraction":
      Mock = Object.create(MessageComponentInteraction.prototype);
      Object.defineProperty(Mock, "constructor", {
        value: MessageComponentInteraction,
        configurable: true,
      });
      break;

    case "ChatInputCommandInteraction":
      Mock = Object.create(ChatInputCommandInteraction.prototype);
      Object.defineProperty(Mock, "constructor", {
        value: ChatInputCommandInteraction,
        configurable: true,
      });
      break;

    case "CommandInteraction":
      Mock = Object.create(CommandInteraction.prototype);
      Object.defineProperty(Mock, "constructor", {
        value: CommandInteraction,
        configurable: true,
      });
      break;

    default:
      throw new Error(`Unknown interaction type: ${type}`);
  }

  return Object.assign(Mock, BaseMock);
}

describe("BaseExtraContainer", () => {
  let Container: BaseExtraContainer;
  beforeEach(() => {
    Container = new BaseExtraContainer();
  });

  test("should initialize with default values", () => {
    expect(Container.title).toBeNull();
    expect(Container.description).toBeNull();
    expect(Container.accentColor).toBeNull();
    expect(Container.thumbnail).toBeNull();
    expect(Container.footer).toBeNull();
  });

  test("setColor should update accentColor", () => {
    const colorSpy = jest.spyOn(Container, "setAccentColor");
    Container.setColor(Colors.Red);
    expect(colorSpy).toHaveBeenCalled();

    Container.setColor(null);
    expect(Container.accentColor).toBeNull();
  });

  test("setTitle should update title and related components", () => {
    Container.setTitle("Test Title");
    expect(Container.title).toBe("Test Title");

    Container.setTitle(null);
    expect(Container.title).toBe("");

    Container.setTitle(undefined);
    expect(Container.title).toBe("");

    Container.setTitle("");
    expect(Container.title).toBe("");
  });

  test("setDescription should update description", () => {
    Container.setDescription("Test description");
    expect(Container.description).toBe("Test description");

    Container.setDescription("Text");
    expect(Container.description).toBe("Text");

    Container.setDescription("Hello %s", "World");
    expect(Container.description).toBe("Hello World");
  });

  test("setFooter should add and remove footer components", () => {
    Container.setFooter("Test footer");
    const FooterIndex_1 = Container.components.findLastIndex(
      (c) => c.data.type === ComponentType.TextDisplay && c.data.id === 3
    );

    expect(Container.footer).toBe("Test footer");
    expect(FooterIndex_1).toBeGreaterThan(1);
    expect((Container.components[FooterIndex_1] as TextDisplayBuilder).data.content).toBe(
      "-# Test footer"
    );

    Container.setFooter(null);
    expect(Container.footer).toBeNull();
    expect(
      Container.components.findLastIndex(
        (c) => c.data.type === ComponentType.TextDisplay && c.data.id === 3
      )
    ).toBe(-1);

    Container.setFooter("-# Formatted footer");
    expect(Container.footer).toBe("-# Formatted footer");
  });

  test("setThumbnail should update thumbnail and related components", () => {
    Container.setThumbnail("https://example.com/image.png");
    expect(Container.thumbnail).toBe("https://example.com/image.png");

    Container.setThumbnail(null);
    expect(Container.thumbnail).toBeNull();

    const builder = new ThumbnailBuilder({ media: { url: "https://example.com/image2.png" } });
    Container.setThumbnail(builder);
    expect(Container.thumbnail).toBe("https://example.com/image2.png");
  });

  test("attachPromptActionRows should add action row components", () => {
    const ActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("test-button").setLabel("Test Button")
    );

    const AddSpy = jest.spyOn(Container, "addSeparatorComponents");
    const AddActionSpy = jest.spyOn(Container, "addActionRowComponents");

    Container.attachPromptActionRows(ActionRow);

    expect(AddSpy).toHaveBeenCalled();
    expect(AddActionSpy).toHaveBeenCalledWith(ActionRow);

    Container.attachPromptActionRows(ActionRow, { spacing: 2, divider: false });
  });

  test("replyToInteract should handle different interaction types", async () => {
    const CmdInteraction = CreateMockInteraction("ChatInputCommandInteraction", { replied: true });
    await Container.replyToInteract(CmdInteraction);
    expect(CmdInteraction.editReply).toHaveBeenCalled();

    const BtnInteraction = CreateMockInteraction("ButtonInteraction");
    await Container.replyToInteract(BtnInteraction);
    expect(BtnInteraction.reply).toHaveBeenCalled();

    const CompInteraction = CreateMockInteraction("MessageComponentInteraction", {
      message: { flags: { has: jest.fn().mockReturnValue(true) } },
    });

    await Container.replyToInteract(CompInteraction, false, true, "editReply");
    expect(CompInteraction.update).toHaveBeenCalled();

    await Container.replyToInteract(BtnInteraction, true);
    expect(BtnInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      })
    );

    await Container.replyToInteract(BtnInteraction, false, true, "followUp");
    expect(BtnInteraction.followUp).toHaveBeenCalled();
  });

  test("should handle empty string inputs properly", () => {
    Container.setTitle("");
    Container.setFooter("");
    Container.setDescription("");

    expect(Container.title).toBe("");
    expect(Container.footer).toBeNull();
    expect(Container.description).toBe(" ");
  });

  test("should handle component structure changes when adding/removing thumbnails", () => {
    // Add thumbnail then remove it - structure should revert properly
    Container.setThumbnail("https://example.com/image.png");
    expect(Container.components[0] instanceof SectionBuilder).toBeTruthy();

    Container.setThumbnail(null);
    expect(Container.components[0] instanceof TextDisplayBuilder).toBeTruthy();
    expect(Container.components.length).toBe(3); // Title, separator, description

    const Container_V2 = new BaseExtraContainer();
    Container_V2.components.splice(0, Container_V2.components.length);
    const Result = Container_V2.setThumbnail(null);
    expect(Result).toBe(Container_V2);
    expect(Container_V2.thumbnail).toBeNull();

    Container_V2.setThumbnail((builder) => builder.setURL("https://example.com/func.jpg"));
    expect(Container_V2.thumbnail).toBe("https://example.com/func.jpg");

    const NewContainer = new BaseExtraContainer();
    NewContainer.components.splice(0, NewContainer.components.length);
    NewContainer.setThumbnail("https://example.com/test.jpg");
    expect(NewContainer.components[0] instanceof SectionBuilder).toBeTruthy();
  });

  test("attachPromptActionRows should handle various container states", () => {
    // Test with an existing action row
    const ActionRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("test-button-1").setLabel("Button 1")
    );
    const ActionRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("test-button-2").setLabel("Button 2")
    );

    Container.attachPromptActionRows(ActionRow1);
    expect(Container.components[Container.components.length - 1]).toBe(ActionRow1);

    // Test replacing existing action row
    Container.attachPromptActionRows(ActionRow2);
    expect(Container.components[Container.components.length - 1]).toBe(ActionRow2);

    // Test with footer then action row
    const NewContainer = new BaseExtraContainer();
    NewContainer.setFooter("Test Footer");
    NewContainer.attachPromptActionRows(ActionRow1);

    const FooterIndex = NewContainer.components.findIndex(
      (c) => c.data.type === ComponentType.TextDisplay && c.data.id === 3
    );

    expect(FooterIndex).toBeGreaterThan(0);
    expect(NewContainer.components[NewContainer.components.length - 1]).toBe(ActionRow1);
  });

  test("attachPromptActionRows should handle action rows with separators configuration", () => {
    const Container = new BaseExtraContainer();
    const ActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("test-btn").setLabel("Test")
    );

    Container.attachPromptActionRows(ActionRow, { spacing: undefined, divider: undefined });
    const ContainerWithFooter = new BaseExtraContainer();
    ContainerWithFooter.setFooter("Test Footer");

    const Separator = new SeparatorBuilder();
    const FooterIndex = ContainerWithFooter.components.findLastIndex(
      (c) => c.data.type === ComponentType.TextDisplay && c.data.id === 3
    );

    ContainerWithFooter.spliceComponents(FooterIndex + 1, 0, Separator);
    ContainerWithFooter.attachPromptActionRows(ActionRow);
    expect(ContainerWithFooter.components[ContainerWithFooter.components.length - 1]).toBe(
      ActionRow
    );
  });

  test("should support attaching multiple action rows at once", () => {
    const ActionRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("test-button-1").setLabel("Button 1")
    );

    const ActionRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("test-button-2").setLabel("Button 2")
    );

    const ActionRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("test-button-3").setLabel("Button 3")
    );

    // Attach multiple rows at once using an array
    Container.attachPromptActionRows([ActionRow1, ActionRow2, ActionRow3]);

    // Verify all three rows were added with proper order
    const componentCount = Container.components.length;
    expect(Container.components[componentCount - 3]).toBe(ActionRow1);
    expect(Container.components[componentCount - 2]).toBe(ActionRow2);
    expect(Container.components[componentCount - 1]).toBe(ActionRow3);
  });

  test("should properly replace multiple existing action rows", () => {
    // First add multiple action rows
    const OldRows = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("old-button-1").setLabel("Old 1")
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("old-button-2").setLabel("Old 2")
      ),
    ];

    Container.attachPromptActionRows(OldRows);

    // Now replace them with different action rows
    const NewRows = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("new-button-1").setLabel("New 1")
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("new-button-2").setLabel("New 2")
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("new-button-3").setLabel("New 3")
      ),
    ];

    Container.attachPromptActionRows(NewRows);

    // Verify old rows were removed and new ones added
    const ActionRows = Container.components.filter((c) => c instanceof ActionRowBuilder);
    expect(ActionRows.length).toBe(3);
    expect(ActionRows).toEqual(NewRows);
  });

  test("should maintain footer when attaching multiple action rows", () => {
    // Set a footer first
    Container.setFooter("Test Footer");

    // Now attach multiple action rows
    const ActionRows = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("test-button-1").setLabel("Button 1")
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("test-button-2").setLabel("Button 2")
      ),
    ];

    Container.attachPromptActionRows(ActionRows);

    // Verify the footer is still present
    const FooterIndex = Container.components.findIndex(
      (c) => c.data.type === ComponentType.TextDisplay && c.data.id === 3
    );

    expect(FooterIndex).toBeGreaterThan(0);

    // And both action rows are present after the footer
    const ActionRowsComponents = Container.components.filter((c) => c instanceof ActionRowBuilder);
    expect(ActionRowsComponents.length).toBe(2);
    expect(ActionRowsComponents).toEqual(ActionRows);
  });

  test("should preserve all action rows when setting footer", () => {
    // First add multiple action rows
    const ActionRows = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("test-button-1").setLabel("Button 1")
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("test-button-2").setLabel("Button 2")
      ),
    ];

    Container.attachPromptActionRows(ActionRows);

    // Now set a footer
    Container.setFooter("Test Footer");

    // Verify the footer was added
    expect(Container.footer).toBe("Test Footer");

    // And both action rows are still present and at the end
    const ComponentCount = Container.components.length;
    expect(Container.components[ComponentCount - 2]).toBe(ActionRows[0]);
    expect(Container.components[ComponentCount - 1]).toBe(ActionRows[1]);
  });

  test("should preserve multiple action rows when removing footer", () => {
    // Add footer and multiple action rows
    Container.setFooter("Test Footer").attachPromptActionRows([
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("test-button-1").setLabel("Button 1")
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("test-button-2").setLabel("Button 2")
      ),
    ]);

    // Now remove the footer
    Container.setFooter(null);

    // Verify footer is gone
    expect(Container.footer).toBeNull();

    // But action rows remain
    const actionRows = Container.components.filter((c) => c instanceof ActionRowBuilder);
    expect(actionRows.length).toBe(2);
  });

  test("should handle the lifecycle of multiple modifications with multiple action rows", () => {
    // Multiple changes to verify integration of all features
    const ActionRows1 = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("btn-1").setLabel("Button 1")
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("btn-2").setLabel("Button 2")
      ),
    ];

    const ActionRows2 = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("btn-3").setLabel("Button 3")
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("btn-4").setLabel("Button 4")
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("btn-5").setLabel("Button 5")
      ),
    ];

    Container.setTitle("Test Title")
      .setDescription("Test Description")
      .attachPromptActionRows(ActionRows1)
      .setFooter("First Footer")
      .setFooter("Updated Footer")
      .attachPromptActionRows(ActionRows2)
      .setThumbnail("https://example.com/image.png");

    // Verify final state
    expect(Container.title).toBe("Test Title");
    expect(Container.description).toBe("Test Description");
    expect(Container.footer).toBe("Updated Footer");
    expect(Container.thumbnail).toBe("https://example.com/image.png");

    // And verify all action rows are the latest ones
    const actionRows = Container.components.filter((c) => c instanceof ActionRowBuilder);
    expect(actionRows.length).toBe(3);
    expect(actionRows).toEqual(ActionRows2);
  });
});

describe("InfoContainer", () => {
  let Container: InfoContainer;
  beforeEach(() => {
    Container = new InfoContainer();
  });

  test("should initialize with info defaults", () => {
    expect(Container.title).toBe("Information");
    expect(Container.accentColor).toBe(Colors.Info);
    expect(Container.description).toBe("[Information Description]");
  });

  test("useInfoTemplate should apply correct info template", () => {
    const TemplateName = Object.keys(InfoMessages)[0] as keyof typeof InfoMessages;
    const Template = InfoMessages[TemplateName];

    Container.useInfoTemplate(TemplateName, "test-arg");
    expect(Container.title).toBe(Template.Title);
  });
});

describe("WarnContainer", () => {
  let Container: WarnContainer;
  beforeEach(() => {
    Container = new WarnContainer();
  });

  test("should initialize with warning defaults", () => {
    expect(Container.title).toBe("Warning");
    expect(Container.accentColor).toBe(Colors.Warning);
    expect(Container.description).toBe("[Warning Description]");
  });
});

describe("ErrorContainer", () => {
  let Container: ErrorContainer;
  beforeEach(() => {
    Container = new ErrorContainer();
  });

  test("should initialize with error defaults", () => {
    expect(Container.title).toBe("Error");
    expect(Container.accentColor).toBe(Colors.Error);
    expect(Container.description).toBe("[Error Description]");
  });

  test("setErrorId should update footer with error ID", () => {
    Container.setErrorId("E12345");
    expect(Container.footer).toBe("Error ID: `E12345`");
  });

  test("useErrClass should apply error object properties", () => {
    const AppErrorInst = new AppError({
      title: "Custom Error",
      message: "This is a custom error message",
    });

    Container.useErrClass(AppErrorInst);
    expect(Container.title).toBe("Custom Error");
    expect(Container.description).toBe("This is a custom error message");

    const StdError = new Error("Standard error message");
    Container.useErrClass(StdError);
    expect(Container.title).toBe("Error");
    expect(Container.description).toBe("Standard error message");
  });

  test("useErrTemplate should apply correct error template", () => {
    const TemplateName = Object.keys(ErrorMessages)[0] as keyof typeof ErrorMessages;
    const Template = ErrorMessages[TemplateName];

    Container.useErrTemplate(TemplateName, "test-arg");
    expect(Container.title).toBe(Template.Title);
    expect(Container.description).toBe(Template.Description);
  });
});

describe("SuccessContainer", () => {
  let Container: SuccessContainer;
  beforeEach(() => {
    Container = new SuccessContainer();
  });

  test("should initialize with success defaults", () => {
    expect(Container.title).toBe("Success");
    expect(Container.accentColor).toBe(Colors.Success);
    expect(Container.description).toBe("[Success Description]");
  });

  test("useTemplate should apply correct info template", () => {
    const TemplateName = Object.keys(InfoMessages)[0] as keyof typeof InfoMessages;
    const Template = InfoMessages[TemplateName];

    Container.useTemplate(TemplateName, "test-arg");
    expect(Container.title).toBe(Template.Title);
    expect(Container.description).toBe(Template.Description);
  });
});

describe("UnauthorizedContainer", () => {
  let Container: UnauthorizedContainer;
  beforeEach(() => {
    Container = new UnauthorizedContainer();
  });

  test("should initialize with unauthorized defaults", () => {
    expect(Container.title).toBe("Unauthorized");
    expect(Container.accentColor).toBe(Colors.Error);
    expect(Container.description).toBe("[Unauthorized Description]");
  });

  test("useErrTemplate should apply correct error template", () => {
    const TemplateName = Object.keys(ErrorMessages)[0] as keyof typeof ErrorMessages;
    const Template = ErrorMessages[TemplateName];

    Container.useErrTemplate(TemplateName, "test-arg");
    expect(Container.title).toBe(Template.Title);
    expect(Container.description).toBe(Template.Description);
  });
});

describe("Integration Tests", () => {
  test("Containers should be able to chain methods properly", () => {
    const Container = new InfoContainer()
      .setTitle("Chained Title")
      .setDescription("Chained Description")
      .setFooter("Chained Footer")
      .setThumbnail("https://example.com/thumbnail.png")
      .setColor(Colors.Blue);

    expect(Container.title).toBe("Chained Title");
    expect(Container.description).toBe("Chained Description");
    expect(Container.footer).toBe("Chained Footer");
    expect(Container.thumbnail).toBe("https://example.com/thumbnail.png");
  });

  test("Containers should handle action rows and interactions correctly", async () => {
    const Container = new SuccessContainer()
      .setTitle("Interactive Container")
      .setDescription("This container has buttons")
      .attachPromptActionRows(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("test-button").setLabel("Test Button")
        )
      );

    const Interaction = CreateMockInteraction("ButtonInteraction");
    await Container.replyToInteract(Interaction);
    expect(Interaction.reply).toHaveBeenCalled();
  });
});

describe("Error Case Handling", () => {
  test("replyToInteract should handle rejection gracefully with silent=true", async () => {
    const Container = new InfoContainer();
    const Interaction = CreateMockInteraction("ButtonInteraction");

    Interaction.reply = jest.fn().mockRejectedValue(new Error("Test error"));
    Interaction.followUp = jest.fn().mockRejectedValue(new Error("Test error"));

    const Result = await Container.replyToInteract(Interaction, false, true);
    expect(Result).toBeNull();
    expect(Interaction.reply).toHaveBeenCalled();
    expect(Interaction.followUp).toHaveBeenCalled();
  });

  test("replyToInteract should propagate errors when silent=false", async () => {
    const Container = new InfoContainer();
    const Interaction = CreateMockInteraction("ButtonInteraction");

    Interaction.reply = jest.fn().mockRejectedValue(new Error("Test error"));
    Interaction.followUp = jest.fn().mockRejectedValue(new Error("Test error"));

    await expect(Container.replyToInteract(Interaction, false, false)).rejects.toThrow(
      "Test error"
    );
  });
});

describe("Template System", () => {
  test("should handle template with formatting arguments correctly", () => {
    const MockMessages = {
      TestTemplate: {
        Title: "Test Title",
        Description: "Hello %s, your number is %d",
      },
    };

    const OriginalMessages = { ...InfoMessages };
    Object.assign(InfoMessages, MockMessages);

    const Container = new InfoContainer();
    Container.useInfoTemplate("TestTemplate" as any, "World", 42);

    expect(Container.title).toBe("Test Title");
    expect(Container.description).toBe("Hello World, your number is 42");
    Object.assign(InfoMessages, OriginalMessages);
  });
});

describe("Complex Interaction Tests", () => {
  test("replyToInteract should handle multiple interaction states", async () => {
    const Container = new InfoContainer();

    // Test deferred command interaction
    const DeferredCmd = CreateMockInteraction("ChatInputCommandInteraction", {
      deferred: true,
      replied: false,
    });
    await Container.replyToInteract(DeferredCmd);
    expect(DeferredCmd.editReply).toHaveBeenCalled();

    // Test replied button interaction
    const RepliedBtn = CreateMockInteraction("ButtonInteraction", {
      replied: true,
      deferred: false,
    });
    await Container.replyToInteract(RepliedBtn);
    expect(RepliedBtn.editReply).toHaveBeenCalled();

    // Test with update method and MessageComponentInteraction
    const ComponentInteraction = CreateMockInteraction("MessageComponentInteraction", {
      message: {
        flags: {
          has: jest.fn().mockImplementation((flag) => flag === MessageFlags.IsComponentsV2),
        },
      },
    });

    await Container.replyToInteract(ComponentInteraction, false, true, "editReply");
    expect(ComponentInteraction.update).toHaveBeenCalled();
  });

  test("replyToInteract should fall back correctly when primary methods fail", async () => {
    const Container = new InfoContainer();

    // Setup a component interaction that fails on update but succeeds on followUp
    const FailingInteraction = CreateMockInteraction("MessageComponentInteraction");
    FailingInteraction.update = jest.fn().mockRejectedValue(new Error("Update failed"));
    FailingInteraction.followUp = jest.fn().mockResolvedValue({});

    await Container.replyToInteract(FailingInteraction, false, true, "editReply");

    expect(FailingInteraction.update).toHaveBeenCalled();
    expect(FailingInteraction.followUp).toHaveBeenCalled();
  });

  test("replyToInteract should handle interaction reply fallback scenarios", async () => {
    const Container = new BaseExtraContainer();
    const BtnInteraction = CreateMockInteraction("ButtonInteraction");

    BtnInteraction.reply = jest.fn().mockRejectedValue(new Error("Reply failed"));
    await Container.replyToInteract(BtnInteraction, false, true);
    expect(BtnInteraction.followUp).toHaveBeenCalled();

    // Test MessageComponentInteraction fallback paths
    const CompInteraction = CreateMockInteraction("MessageComponentInteraction");
    CompInteraction.update = jest.fn().mockRejectedValue(new Error("Update failed"));
    await Container.replyToInteract(CompInteraction, false, true, "editReply");
    expect(CompInteraction.followUp).toHaveBeenCalled();
  });
});

describe("ApplyContainerTemplate Function", () => {
  test("should correctly apply templates with thumbnails", () => {
    const MockMessages = {
      TemplateWithThumb: {
        Title: "Thumb Template",
        Thumb: "https://example.com/thumbnail.jpg",
        Description: "This template has a thumbnail",
      },
    };

    const OriginalMessages = { ...InfoMessages };
    Object.assign(InfoMessages, MockMessages);

    const Container = new InfoContainer();
    Container.useInfoTemplate("TemplateWithThumb" as any);

    expect(Container.title).toBe("Thumb Template");
    expect(Container.description).toBe("This template has a thumbnail");
    expect(Container.thumbnail).toBe("https://example.com/thumbnail.jpg");
    expect(resolveColor(Container.accentColor!)).toBe(resolveColor(Colors.Info));

    Object.assign(InfoMessages, OriginalMessages);
  });

  test("should respect existing thumbnail if template doesn't specify one", () => {
    const Container = new InfoContainer();
    Container.setThumbnail("https://example.com/original.jpg");

    const TemplateName = Object.keys(InfoMessages)[0] as keyof typeof InfoMessages;
    Container.useInfoTemplate(TemplateName);

    expect(Container.thumbnail).toBe("https://example.com/original.jpg");
  });
});

describe("Container Lifecycle", () => {
  test("should maintain consistent state through multiple modifications", () => {
    const Container = new InfoContainer()
      .setTitle("Initial Title")
      .setDescription("Initial Description")
      .setFooter("Initial Footer");

    // Add thumbnail
    Container.setThumbnail("https://example.com/thumb1.jpg");
    expect(Container.components[0] instanceof SectionBuilder).toBeTruthy();

    // Change title
    Container.setTitle("Updated Title");
    expect(Container.title).toBe("Updated Title");

    // Add action row
    const ActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("test-btn").setLabel("Test")
    );
    Container.attachPromptActionRows(ActionRow);

    // Change thumbnail
    Container.setThumbnail("https://example.com/thumb2.jpg");
    expect(Container.thumbnail).toBe("https://example.com/thumb2.jpg");

    // Remove thumbnail
    Container.setThumbnail(null);
    expect(Container.thumbnail).toBeNull();

    // Verify final state
    expect(Container.title).toBe("Updated Title");
    expect(Container.footer).toBe("Initial Footer");
    expect(Container.components.length).toBeGreaterThan(3); // Title, separator, description, footer separator, footer, action row
  });
});
