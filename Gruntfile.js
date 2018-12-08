module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    glsl: {
      dist: {
        options: {
          oneString: false
        },
        files: {
          'shaders.js': [ 'shaders/*.glsl' ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-glsl');
  grunt.registerTask('default', ['glsl']);
}