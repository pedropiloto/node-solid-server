test: ## run testinfra tests against the project
	docker run --rm -t \
		-v $(shell pwd):/project \
		-v /var/run/docker.sock:/var/run/docker.sock:ro \
		aveltens/docker-testinfra

lint: ## run hadolint against the Dockerfile
	docker run --rm -i hadolint/hadolint < src/Dockerfile

build: ## build the docker image
	cd src && docker build --tag nodesolidserver/node-ldp-web-server .

inspect: build ## run a shell in the docker image
	docker run --rm -it --entrypoint sh nodesolidserver/node-ldp-web-server

start: build ## start ldp-web-server docker container
	docker run --rm \
		-it -d \
		-p 8443:8443 \
		-u "$(id -u):$(id -g)" \
		-v $(shell pwd)/data:/opt/ldp-web/data \
		--name ldp-web-server \
		nodesolidserver/node-ldp-web-server

stop: ## stop the ldp-web-server docker container
	docker stop ldp-web-server

attach: ## execute a shell in the running ldp-web-server docker container
	docker exec -it ldp-web-server sh

.PHONY: test build inspect run attach
