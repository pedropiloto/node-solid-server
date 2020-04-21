# coding=utf-8
import docker
import pytest
import time

testinfra_hosts = ['docker://test_container']


@pytest.fixture(scope="module", autouse=True)
def container(client, image):
  container = client.containers.run(
      image.id,
      name="test_container",
      volumes={
        'missing_data': {'bind': '/opt/ldp-web/data'},
        'missing_db': {'bind': '/opt/ldp-web/.db'},
        'missing_config': {'bind': '/opt/ldp-web/config'}
      },
      environment=[
        "SOLID_SSL_KEY=/missing/key",
        "SOLID_SSL_CERT=/missing/cert"
      ],
      detach=True,
      tty=True
  )
  # give the ldp-web process some seconds to create the directory structure before making assertions
  time.sleep(2)
  yield container
  container.remove(force=True)


def test_container_fails_with_errors(container):
  assert container.status == "created"
  logs = container.logs()
  assert "✗ /opt/ldp-web/config not writable by node" in logs
  assert "✗ /opt/ldp-web/data not writable by node" in logs
  assert "✗ /opt/ldp-web/.db not writable by node" in logs
  assert "✗ /missing/key does not exist" in logs
  assert "✗ /missing/cert does not exist" in logs
  assert "Finished: ERROR" in logs
  assert not "Finished: SUCCESS" in logs
