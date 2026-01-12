module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ใส่ Reanimated plugin ไว้บรรทัดสุดท้ายเสมอ
      'react-native-reanimated/plugin',
    ],
  };
};
