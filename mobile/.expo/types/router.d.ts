/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)` | `/(auth)/login` | `/(auth)/register` | `/(tabs)` | `/(tabs)/budgets` | `/(tabs)/chat` | `/(tabs)/dashboard` | `/(tabs)/insights` | `/(tabs)/simulate` | `/(tabs)/transactions` | `/_sitemap` | `/budgets` | `/chat` | `/dashboard` | `/insights` | `/login` | `/register` | `/simulate` | `/statement-review` | `/transactions`;
      DynamicRoutes: never;
      DynamicRouteTemplate: never;
    }
  }
}
