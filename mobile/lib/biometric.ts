import * as LocalAuthentication from "expo-local-authentication";

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function authenticateWithBiometric(): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return true; // fall through if not set up

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Helm",
    fallbackLabel: "Use Passcode",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}
