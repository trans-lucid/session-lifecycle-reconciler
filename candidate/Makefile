.PHONY: dev logs seed test test-unit test-integration run clean

dev:
	docker compose up -d

logs:
	docker compose logs -f

seed:
	npm run migrate
	npm run seed

test:
	npm run test:public

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

run:
	npm run run

clean:
	docker compose down -v

