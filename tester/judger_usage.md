## Run the Tester

team 1: `ssh -2 root@10.160.209.161`
team 2: `ssh -2 root@10.160.165.210`
team 3: `ssh -2 root@10.160.134.159`
team 4: `ssh -2 root@10.160.226.255`
team 5: `ssh -2 root@10.161.16.86`
team 6: `ssh -2 root@10.160.210.45`
team 7: `ssh -2 root@10.192.146.33`
team 8: `ssh -2 root@10.162.63.152`
team 9: `ssh -2 root@10.161.231.100`
team 10: `ssh -2 root@10.161.239.41`

cd tester

Run the tester accordingly:

```shell
RADIO_2017_SH_HOST=10.110.125.221 \
/root/node611/bin/node index.js
```

```shell
RADIO_2017_SH_HOST=10.110.125.221 \
RADIO_2017_SH_PORT=8080 \
RADIO_2017_SH_SPEED_FACTOR=100 \
/root/node611/bin/node index.js
```

```shell
RADIO_2017_SH_HOST=10.110.125.221 \
RADIO_2017_SH_PROBLEM=bonus \
RADIO_2017_SH_PATH=/qs/solve \
/root/node611/bin/node index.js
```

## Enviornment Variables

* RADIO_2017_SH_PROBLEM - the problem type. Set it to _bonus_ for bonus problem. Otherwise the test is for basic problem.
* RADIO_2017_SH_SPEED_FACTOR - the interval in millisecond (_speed factor_) the test requests will be sent for the test of basic problem. Default to _10_.
* RADIO_2017_SH_HOST - the server ip/hostname. Default to _localhost_.
* RADIO_2017_SH_PORT - the port. Default to _3000_.
* RADIO_2017_SH_PATH - the path of the service. Default to _/radio-2017-sh/solve_.
