// 定义解决方案和评分对的类型
interface SolutionScorePair {
  solution: string; // 解决方案或提示
  score: number; // 解决方案或提示的评分
}

// 定义元提示（meta-prompt）的类型
interface MetaPrompt {
  problemDescription: string; // 问题的自然语言描述
  optimizationTrajectory: SolutionScorePair[]; // 优化轨迹，包含之前生成的解决方案及其评分
  metaInstructions: string; // 元指令，指导LLM如何使用上述信息
  taskExamples: TaskExample[]; // 从训练集中随机选取的任务示例
}

// 定义任务输入输出对的类型
interface TaskExample {
  input: string; // 任务输入
  output: string; // 任务输出
}

// 定义LLM生成新解决方案或提示的函数类型
type GenerateSolutionsOrPromptsFunction = (
  metaPrompt: MetaPrompt
) => Promise<SolutionScorePair[]>;

// 定义将新解决方案或提示添加到元提示中的函数类型
type AddSolutionsOrPromptsToMetaPromptFunction = (
  metaPrompt: MetaPrompt,
  newSolutionsOrPrompts: SolutionScorePair[]
) => MetaPrompt;

// 定义执行优化过程的函数类型
type OptimizeFunction = (metaPrompt: MetaPrompt) => Promise<SolutionScorePair>;

// OPRO/APE框架类型定义
interface OPROAPEFramework {
  generateSolutionsOrPrompts: GenerateSolutionsOrPromptsFunction; // 生成新解决方案或提示的函数
  addSolutionsOrPromptsToMetaPrompt: AddSolutionsOrPromptsToMetaPromptFunction; // 将新解决方案或提示添加到元提示中的函数
  optimize: OptimizeFunction; // 执行优化过程的函数
}

// 使用框架的示例
const oproApeFramework: OPROAPEFramework = {
  generateSolutionsOrPrompts: async (metaPrompt: MetaPrompt) => {
    // 实现LLM调用逻辑，生成新解决方案或提示
  },
  addSolutionsOrPromptsToMetaPrompt: (
    metaPrompt: MetaPrompt,
    newSolutionsOrPrompts: SolutionScorePair[]
  ) => {
    // 实现将新解决方案或提示添加到元提示的逻辑
  },
  optimize: async (metaPrompt: MetaPrompt) => {
    // 实现优化逻辑，返回最佳解决方案或提示
  },
};
