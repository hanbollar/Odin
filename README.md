Odin
===============
*WebGL 2.0 Crowd-Sim with gpu.js*


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

[Milestone 1](./milestones/Milestone1.md)

[Milestone 2](./milestones/Milestone2.md)

[Milestone 3](./milestones/Milestone3.md)

## Build and Run Instructions

#### Build
```
Clone this repository
Download and install Node.js
Run `npm install` in the root directory which will download and install dependencies.
Lastly Run `npm install gpu.js`
```

#### Run
Need WebGL2-capable browser to run this project. Check for support on [WebGL Report](http://webglreport.com/?v=2) 

```
Go to root directory
Run `npm start`
Navigate to http://localhost:5650 on a browser that supports WebGL2
```

## References

- [Project 5 GPU CIS 565 project](https://github.com/CIS565-Fall-2018/Project5-WebGL-Clustered-Deferred-Forward-Plus) - for node.js project setup
- gpu.js
	- [gpu.js](http://gpu.rocks/) - for gpu.js info
	- [gpu.js github](https://github.com/gpujs/gpu.js) - for download instructions and how to use it in webgl framework
	- [gpu.js include examples](http://geoexamples.com/other/2018/04/30/mapping-with-gpujs.html]) - for how to properly include and setup gpu.js functions
	- [gpu.js typescript ex 1](https://staceytay.com/raytracer/)
	- [gpu.js typescript ex 2](https://github.com/abhisheksoni27/gpu.js-demo)
	- [issues with vec3 and vec4 in glsl in gpu.js](https://github.com/gpujs/gpu.js/issues/7)
	- [add native function so can use alternate glsl functions like in a shader](https://github.com/gpujs/gpu.js/issues/62)
	- [images as input and ouput for gpu.js](https://github.com/gpujs/gpu.js/issues/296)
- Crowd Simulation
	- [CrowdSimulation by Thalmann and Musse - BioCrowds](https://books.google.com/books?id=3Adh_2ZNGLAC&pg=PA146&lpg=PA146&dq=biocrowds%20algorithm&source=bl&ots=zsM86iYTot&sig=KQJU7_NagMK4rbpY0oYc3bwCh9o&hl=en&sa=X&ved=0ahUKEwik9JfPnubSAhXIxVQKHUybCxUQ6AEILzAE#v=onepage&q=biocrowds%20algorithm&f=false)
	- [Austin Eng's basic explanation of BioCrowds](https://cis700-procedural-graphics.github.io/files/biocrowds_3_21_17.pdf), [Austin Eng](http://austin-eng.co/)
	- [Dr. Musse's Crowds talk at VHLab 2016](http://www.inf.pucrs.br/~smusse/Animacao/2016/CrowdTalk.pdf)
	- [Space Colonization Algorithm Paper 2012](https://www.sciencedirect.com/science/article/pii/S0097849311001713)
- npm
	- [mat3 linear algebra npm known funcs](https://www.npmjs.com/package/gl-matrix)
- webgl2 specifications
	- [webgl2 vs webgl1](https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html)
	- [canvas size vs gl framebuffer read only](https://github.com/KhronosGroup/WebGL/issues/2460)
	- [issues with device pixel ratio](https://stackoverflow.com/questions/24209628/how-to-override-device-pixel-ratio)
- Walking Figures
	- [signed distance functions](http://jamie-wong.com/2016/07/15/ray-marching-signed-distance-functions/)
	- [IQ's website](http://iquilezles.org/index.html)
