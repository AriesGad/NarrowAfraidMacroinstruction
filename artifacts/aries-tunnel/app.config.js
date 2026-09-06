import appJson from './app.json';

export default {
  ...appJson,
  extra: {
    ...(appJson.extra || {}),
    router: {
      ...(appJson.extra?.router || {}),
      // Allow the Base44 preview origin through Expo CLI's CORS middleware.
      // The suffix changes when the environment is recreated, so derive it at runtime.
      ...(process.env.BASE44_PUBLIC_HOST_SUFFIX
        ? { origin: `https://3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}` }
        : {}),
    },
  },
};
