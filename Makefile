.PHONY: install validate-solution validate-candidate-main-expected-failure validate-docker-integration validate-rendered-smoke render scan-safety validate clean

install:
	cd candidate && npm ci

validate-solution: install
	EVAL_TARGET="$(PWD)/solution" ./candidate/node_modules/.bin/vitest run --config tools/template_vitest.config.ts

validate-candidate-main-expected-failure: install
	bash tools/expect_candidate_failure.sh

validate-docker-integration: install
	bash tools/expect_candidate_docker_failure.sh

validate-rendered-smoke: render scan-safety
	bash tools/validate_rendered_smoke.sh

render:
	python3 tools/render_template.py

scan-safety:
	python3 tools/scan_safety.py

validate: validate-solution validate-candidate-main-expected-failure render scan-safety validate-rendered-smoke validate-docker-integration

clean:
	rm -rf generated
	cd candidate && docker compose down -v || true
