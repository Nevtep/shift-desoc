import type { Preview } from "@storybook/nextjs";
import "../src/app/globals.css";
import { TamaguiProvider } from "../src/lib/tamagui/TamaguiProvider";
import { I18nProvider } from "../src/lib/i18n/I18nContext";
import type { Language } from "../src/lib/i18n";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#f5f5e8" },
        { name: "dark", value: "#2c2c2c" },
      ],
    },
  },
  globalTypes: {
    locale: {
      name: "Language",
      description: "Interface language",
      defaultValue: "es",
      toolbar: {
        icon: "globe",
        items: [
          { value: "es", title: "Español" },
          { value: "en", title: "English" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const locale = (context.globals.locale as Language) ?? "es";

      return (
        <TamaguiProvider>
          <I18nProvider initialLanguage={locale}>
            <Story />
          </I18nProvider>
        </TamaguiProvider>
      );
    },
  ],
};

export default preview;
