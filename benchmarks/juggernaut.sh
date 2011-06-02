#!/bin/bash 
let I=0
while [ $I -lt 50 ]; do
	node juggernaut_subscribe.js &
	let I=I+1
done



