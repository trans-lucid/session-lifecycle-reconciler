export default {
  test: {
    globals: true,
    include: [
      "candidate/tests/public/unit.test.ts",
      "solution/tests/**/*.test.ts",
      "evaluator/tests_hidden/**/*.test.ts"
    ],
    testTimeout: 30_000
  }
};
