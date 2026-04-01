interface TelegramWebAppThemeParams {
  bg_color?: string;
  button_color?: string;
  button_text_color?: string;
  hint_color?: string;
  link_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
}

interface TelegramWebAppInsets {
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
}

interface TelegramWebAppApi {
  contentSafeAreaInset?: TelegramWebAppInsets;
  expand: () => void;
  initData: string;
  ready: () => void;
  safeAreaInset?: TelegramWebAppInsets;
  themeParams?: TelegramWebAppThemeParams;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebAppApi;
  };
}
