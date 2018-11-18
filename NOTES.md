## GPU Final Project - Notes
Hannah Bollar, Eric Chiu

## Crowd Simulation using WebGL 2.0 with gpu.js

### Notes

![1](./images/1.jpg)
#### Notes Session 1 Summary
- Procedural character
	- marionette / signed distance functions for meshing
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

![2](./images/2.jpg)
#### Notes Session 2 Summary
...

#### H - BioCrowds Notes
Biocrowds is a crowd simulation algorithm based on the formation of veination patterns on leaves. It prevents agents from colliding with each other on their way to their goal points using a notion of "personal space". Personal space is modelled with a space colonization algorithm. Markers (just points) are scattered throughout the simulation space, on the ground. At each simulation frame, each marker becomes "owned" by the agent closest to it (with some max distance representing an agent's perception). Agent velocity at the next frame is then computed using a sum of the displacement vectors to each of its markers. Because a marker can only be owned by one agent at a time, this technique prevents agents from colliding with one another.