module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    ecmaVersion: "2019",
    sourceType: "module",
  },
  // 仅做语法与常见问题检查；未安装 eslint-plugin，故不声明 @typescript-eslint/* 规则
  ignorePatterns: ["**/*.js", "*.d.ts"],
  rules: {
    "no-empty": "off",
    "no-unused-expressions": ["warn", { allowShortCircuit: true }],
  },
};
