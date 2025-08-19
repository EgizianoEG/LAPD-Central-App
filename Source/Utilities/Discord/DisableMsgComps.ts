import { APIMessageTopLevelComponent, ComponentType } from "discord.js";

export default function DisableMessageComponents(
  RawAPIComponents: APIMessageTopLevelComponent[]
): APIMessageTopLevelComponent[] {
  return RawAPIComponents.map((Component) => {
    if (Component.type === ComponentType.ActionRow) {
      return {
        ...Component,
        components: Component.components.map((RowComp) => ({
          ...RowComp,
          disabled: true,
        })),
      };
    } else if (Component.type === ComponentType.Container) {
      return {
        ...Component,
        components: Component.components.map((SubComp) => {
          if (SubComp.type === ComponentType.Section && SubComp.accessory.type !== 11) {
            return {
              ...SubComp,
              accessory: {
                ...SubComp.accessory,
                disabled: true,
              },
            };
          } else if (SubComp.type === ComponentType.ActionRow) {
            return {
              ...SubComp,
              components: SubComp.components.map((RowComp) => ({
                ...RowComp,
                disabled: true,
              })),
            };
          } else {
            return SubComp;
          }
        }),
      };
    } else {
      return Component;
    }
  });
}
