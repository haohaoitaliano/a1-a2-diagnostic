# 学员成绩诊断模板 V1.0

## 基本结果
- 学员姓名：{{name}}
- 考试日期：{{date}}
- 总分：{{total_score}} / 100
- 等级判定：{{level}}
- B1预备判定：{{b1_ready_result}}

## 模块表现
| 模块 | 得分 | 正确率 | 诊断 |
|---|---:|---:|---|
| 高频个人交流场景 | {{personal_score}} | {{personal_accuracy}} | {{personal_comment}} |
| 高频生活场景 | {{life_high_score}} | {{life_high_accuracy}} | {{life_high_comment}} |
| 中低频生活办事场景 | {{life_mid_score}} | {{life_mid_accuracy}} | {{life_mid_comment}} |
| 语法运用 | {{grammar_score}} | {{grammar_accuracy}} | {{grammar_comment}} |
| 语言逻辑 | {{logic_score}} | {{logic_accuracy}} | {{logic_comment}} |

## 能力维度
| 能力维度 | 正确率 | 说明 |
|---|---:|---|
| 阅读理解 | {{reading_accuracy}} | {{reading_comment}} |
| 听力理解 | {{listening_accuracy}} | {{listening_comment}} |
| 语法运用 | {{grammar_dimension_accuracy}} | {{grammar_dimension_comment}} |
| 交际反应 | {{communication_accuracy}} | {{communication_comment}} |
| 语言逻辑 | {{logic_dimension_accuracy}} | {{logic_dimension_comment}} |

## 主要薄弱点
{{weakness_list}}

## 推荐复习路径
1. {{review_step_1}}
2. {{review_step_2}}
3. {{review_step_3}}

## 结论
{{final_comment}}
