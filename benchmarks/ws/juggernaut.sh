#!/bin/bash 
let I=0
while [ $I -lt 4 ]; do
	node juggernaut_subscribe.js &
	let I=I+1
done



