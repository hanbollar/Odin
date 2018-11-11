## GPU Final Project - Notes
Hannah Bollar, Eric Chiu

## Crowd Simulation using WebGL 2.0 with gpu.js

#### Notes
- Procedural character
	- no meshing
	- marionette
	- walk animation (gpu per char for update)
	- reach for char --> non primitive base
- tbd - procedural terrain / city?
- now just load environment base or leave flat plane for basic?
- walk - basic ik with just walk or stop
	- reach for walk --> lerping between walk run and stop depending on dist change
	- rot and lerping dep on move-to location for next iteration?
- biocrowds
	- gpu - for each person - find not used points
	- this (to make sure have basics down), then papers for more advanced techniques
- cycle of walking - limbs / scene graph / etc.