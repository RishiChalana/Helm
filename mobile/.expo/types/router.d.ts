/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)` | `/(auth)/login` | `/(auth)/register` | `/(tabs)` | `/(tabs)/budgets` | `/(tabs)/chat` | `/(tabs)/insights` | `/(tabs)/simulate` | `/(tabs)/transactions` | `/_sitemap` | `/budgets` | `/chat` | `/insights` | `/login` | `/register` | `/simulate` | `/transactions`;
      DynamicRoutes: never;
      DynamicRouteTemplate: never;
    }
  }
}
