Odin
===============
*WebGL Crowd-Sim with GPU.js*


**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Final Project**


#### Developers:
- Hannah Bollar: [LinkedIn](https://www.linkedin.com/in/hannah-bollar/), [Website](http://hannahbollar.com/)
- Eric Chiu: [LinkedIn](https://www.linkedin.com/in/echiu1997/), [Website](http://www.erichiu.com/)

#### Tested on:
- Systems:
	- Windows 10 Home, i7-8550U @ 1.8GHz 15.8 GB (personal)
	- Mac OS X El Capitan 10.11.6, 2.5 GHz Intel Core i7, AMD Radeon R9 M370X 2048 MB (personal)
- Browsers:
	- Google Chrome Version 70.0.3538.77 (Official Build) (64-bit)
	- Firefox Version 63.0.1 (Official Build) (64-bit)

____________________________________________________________________________________

![Developer Hannah](https://img.shields.io/badge/Developer-Hannah-0f97ff.svg?style=flat) ![Developer Eric](https://img.shields.io/badge/Developer-Eric-0f97ff.svg?style=flat) ![WebGL 2.0](https://img.shields.io/badge/WebGL-2.0-lightgrey.svg) ![gpu.js](https://img.shields.io/badge/GPGPU-gpu.js-yellow.svg) ![Built](https://img.shields.io/appveyor/ci/gruntjs/grunt.svg) ![Progress](https://img.shields.io/badge/implementation-in%20progress-orange.svg )


[//]: # ( ![Issues](https://img.shields.io/badge/issues-none-green.svg)

## The Project

In Progress - More information coming soon.

## Build and Run Instructions

#### Build
```
Clone this repository
Download and install Node.js
Run npm install in the root directory which will download and install dependencies.
Run npm start and navigate to http://localhost:5650
```

#### Run
Need WebGL-capable browser to run this project (Chrome seems to work best).
Some notable extensions that might be needed (check for support on WebGL Report) :
```
OES_texture_float
OES_texture_float_linear
OES_element_index_uint
EXT_frag_depth
WEBGL_depth_texture
WEBGL_draw_buffer
```
If there are still issues, make sure you've updated your browser and video drivers.

## References

- [Project 5 GPU CIS 565 project](https://github.com/CIS565-Fall-2018/Project5-WebGL-Clustered-Deferred-Forward-Plus) - for node.js project setup
- [gpu.js](http://gpu.rocks/) - for gpu.js syntax and include file