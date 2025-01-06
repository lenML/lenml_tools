
set -e

# MODEL_CONFIG=./configs/grok-beta.model.json
# MODEL_CONFIG=./configs/llm-studio-any.model.json
MODEL_CONFIG=./configs/deepseek.model.json
REPORT_NAME=deepseek-v3

npx tsx ./run_h_eval.ts --model $MODEL_CONFIG --name $REPORT_NAME

npx tsx ./run_reject_eval.ts --model $MODEL_CONFIG --name $REPORT_NAME

npx tsx ./run_creative_story_eval.ts --model $MODEL_CONFIG --name $REPORT_NAME

npx tsx ./run_num_puzzle.ts --model $MODEL_CONFIG --name $REPORT_NAME

npx tsx ./run_acg01_eval.ts --model $MODEL_CONFIG --name $REPORT_NAME

npx tsx ./collect_score.ts $REPORT_NAME
