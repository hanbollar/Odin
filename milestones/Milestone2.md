[Read Milestone 1](./Milestone1.md) or [Read Milestone 3](./Milestone3.md)
</br>
</br>
# Odin - Milestone 2
Developers:
</br> Hannah Bollar: [LinkedIn](https://www.linkedin.com/in/hannah-bollar/), [Website](http://hannahbollar.com/)
</br> Eric Chiu: [LinkedIn](https://www.linkedin.com/in/echiu1997/), [Website](http://www.erichiu.com/)

## Current Progress:

[View Presentation](./milestone-2/Milestone2_Presentation.pdf)

### Issues resolved from last milestone

- Fixed webgl2 gl framebuffer (read-only variable) not matching requested output
	- manually updated viewport dimensions to force values to match
- Resolved query over using gpu.js vs webgl2 for rendering aspect
	- using webgl2 so to allow for sdf function calculations more easily but still using gpu.js and adding in vector functions for crowd sim movement.

### New Features implemented

- Resolved question - there is a way to keep all important data on the gpu between the kernal calls due to using `outputToTexture` for image creation. see link [here](https://github.com/gpujs/gpu.js/issues/203#issuecomment-337374123) and referred to in main readme.
- voronoi movement using cone structures as "depth" test for associated pixels
- Reupdated pipeline so now using webgl2 vertex and fragment shaders for main visual but using texture reading from all gpu.js calculations for scene to actual do agent movement

### Issues still to resolve from this Milestone

- had to switch back to `setGraphical(true)` instead of `setOutputToTexture(true)` --> so have cpu to gpu and gpu to cpu transfering and not being a direct [pipeline](https://en.wikipedia.org/wiki/Pipeline_(computing)) that setOutputToTexture guarantees.
	- right now framework is in place for gpu to gpu texture passing but doesnt work for some reason (still looking into this)
