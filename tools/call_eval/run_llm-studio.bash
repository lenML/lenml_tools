
set -e

# MODEL_CONFIG=./configs/grok-beta.model.json
MODEL_CONFIG=./configs/llm-studio-any.model.json
# MODEL_CONFIG=./configs/deepseek.model.json
MODEL_NAME=gemma-2-ifable-9b

npx tsx ./run_h_eval.ts --model $MODEL_CONFIG --name $MODEL_NAME

npx tsx ./run_reject_eval.ts --model $MODEL_CONFIG --name $MODEL_NAME

npx tsx ./run_creative_story_eval.ts --model $MODEL_CONFIG --name $MODEL_NAME

npx tsx ./run_num_puzzle.ts --model $MODEL_CONFIG --name $MODEL_NAME

npx tsx ./run_acg01_eval.ts --model $MODEL_CONFIG --name $MODEL_NAME

npx tsx ./collect_score.ts $MODEL_NAME
