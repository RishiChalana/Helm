module.exports = {
  dependencies: {
    // react-native-worklets is used ONLY as a Babel plugin by react-native-css-interop.
    // Its native Android module requires RN 75+, which we don't use. Exclude it from
    // auto-linking so the native build does not try to compile it.
    'react-native-worklets': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
