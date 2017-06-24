# Test Tool for VMware RADIO Crashing Algorithm Competition 2017 Shanghai

## Functionality

This tool will read the [basic problem questions](questions.txt) file or [bonus problem questions](bonusQuestions.txt) file line by line and send requests to the service endpoint to test the problem solver. The results will be compared against the standard answers one by one. The correct rate will be used to calculate the score.

Each HTTP request will be timed out in 30 seconds. And if timeout happens, the test will exit. If the service endpoint crashes due to high traffic volume, the test will exit too.

Due to the system limit of simultaneous HTTP requests of the test client, the requests will be sent in a given interval. With an interval set, the accumulated concurrent HTTP requests will be effected by how fast the response can be. And the test will break if the interval is set too low. **Hence, the lowest interval that the test can run through will reflect the efficiency of the problem solver in some extent.** For ranking, the interval will be used as the **speed factor** to calculate the speed score.

The problem type, server host, port, path and request interval are configurable via environment variables.

## Enviornment Variables

* RADIO_2017_SH_PROBLEM - the problem type. Set it to _bonus_ for bonus problem. Otherwise the test is for basic problem.
* RADIO_2017_SH_SPEED_FACTOR - the interval in millisecond (_speed factor_) the test requests will be sent for the test of basic problem. Default to _10_.
* RADIO_2017_SH_HOST - the server ip/hostname. Default to _localhost_.
* RADIO_2017_SH_PORT - the port. Default to _3000_.
* RADIO_2017_SH_PATH - the path of the service. Default to _/radio-2017-sh/solve_.

## Grading

### Correct Rate Score

Basic Problem: 60 points &times; the correct rate.

Bonus Problem: 40 points &times; the correct rate.

### Speed Score

20 points / speed factor

The speed score is for basic problem only.

### Total Score and Grading

Sum up the correct rate score and speed score for each problem. The top _n_ highest are the winners.

## Test Procedure

Install Node.js and npm if necessary. Then run npm to install dependencies.

```shell
npm i
```

Run the tool like this:

```shell
RADIO_2017_SH_HOST=localhost \
RADIO_2017_SH_PORT=3000 \
RADIO_2017_SH_SPEED_FACTOR=1 \
node index.js
```

Normally, it will output:

> Testing for VMware Crashing Algorithm Competition 2017 Shanghai.
> Test endpoint: http://localhost:3000/radio-2017-sh/solve.
> Speed Factor: 1 (the lower the faster).
> Testing [=============================================] 2021 passed of 2021 
> Test finished. The correct rate is 100%.
> Correct rate score: 60.
> Speed score: 20 / 1 = 20.
> Total score: 80.

Record the score for the test.

Test each server for several rounds by adjusting the RADIO_2017_SH_SPEED_FACTOR from higher to lower number.

If the RADIO_2017_SH_SPEED_FACTOR is too low, the program will break by throwing unhandled error event.

```shell
RADIO_2017_SH_PATH=/qs/solve \
RADIO_2017_SH_SPEED_FACTOR=5 \
node index.js
```

> Testing for VMware Crashing Algorithm Competition 2017 Shanghai.
> Test endpoint: http://localhost:3000/qs/solve.
> Speed Factor: 5 (the lower the faster).
> Testing [================------------------------------] 693 passed of 693 events.js:160
>       throw er; // Unhandled 'error' event
>       ^
> 
> Error: write EPIPE
>     at exports._errnoException (util.js:1018:11)
>     at WriteWrap.afterWrite (net.js:800:14)

No score for the round if this happens. And credit the _**highest score**_ of all rounds for the team.

Run test for bonus problem solver:

```
RADIO_2017_SH_PATH=/qs/solve \
RADIO_2017_SH_PROBLEM=bonus \
node index.js
```

Normally, it will output:

> Testing for VMware Crashing Algorithm Competition 2017 Shanghai. (Bonus Problem)
> Test endpoint: http://localhost:3000/qs/solve.
> Testing [==================================================] 8 passed of 8 
> Test finished. The correct rate is 100%.
> Correct rate score: 40.
