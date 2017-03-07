'use strict';

const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const browserSync = require('browser-sync');
const del = require('del');
const wiredep = require('wiredep').stream;
const mainBowerFile = require('main-bower-files');
const runSequence = require('run-sequence');
const moment = require('moment');
const pkg = require('./package.json');

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

let dev = true;

moment.locale('fr');

gulp.task('styles', () => {
  return gulp.src('app/assets/styles/*.scss')
    .pipe($.plumber())
    .pipe($.if(dev, $.sourcemaps.init()))
    .pipe($.sass.sync({
      outputStyle: 'expanded',
      precision: 10,
      includePaths: ['.']
    }).on('error', $.sass.logError))
    .pipe($.autoprefixer({
      browsers: ['> 1%', 'last 2 versions', 'Firefox ESR']
    }))
    .pipe($.if(dev, $.sourcemaps.write()))
    .pipe(gulp.dest('.tmp/assets/styles'))
    .pipe(reload({stream: true}));
});

gulp.task('scripts', () => {
  return gulp.src('app/assets/scripts/**/*.js')
    .pipe($.plumber())
    .pipe($.if(dev, $.sourcemaps.init()))
    .pipe($.babel())
    .pipe($.if(dev, $.sourcemaps.write('.')))
    .pipe(gulp.dest('.tmp/assets/scripts'))
    .pipe(reload({stream: true}));
});

gulp.task('lint', () =>
  runSequence(['lint:styles'])
);

gulp.task('lint:styles', () => {
  return gulp.src('app/assets/styles/**/*.s+(a|c)ss')
    .pipe($.sassLint())
    .pipe($.sassLint.format())
    .pipe($.sassLint.failOnError());
});

gulp.task('lint:scripts', () => {
  return gulp.src('app/assets/scripts/**/*.js')
    .pipe($.eslint({fix: true}))
    .pipe(reload({stream: true, once: true}))
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
});

gulp.task('views', () => {
  const GOOGLE_ANALYTICS_USER_AGENT = 'UA-11768706-4';

  return gulp.src([
    'app/*.njk'
  ])
    .pipe($.nunjucksRender({
      path: 'app',
      data: {
        experiencesOvh: moment().diff(moment([2016, 3, 1]), 'months'),
        experiencesKonfiture: (2016 - 2011),
        currentYear: moment().format('YYYY'),
        lastUpdate: moment().format('L'),
        googleUserAgent: GOOGLE_ANALYTICS_USER_AGENT
      }
    }))
    .pipe(gulp.dest('.tmp'))
    .pipe(reload({stream: true}));
});

gulp.task('views:reload', ['views'], () => {
  reload();
});

/* eslint-disable camelcase */
gulp.task('html', ['views', 'styles', 'scripts'], () => {
  const banner = ['/**',
    ' * <%= pkg.name %> - <%= pkg.description %>',
    ' * @version v<%= pkg.version %>',
    ' * @link <%= pkg.homepage %>',
    ' * @license <%= pkg.license %>',
    ' */',
    ''].join('\n');

  return gulp.src([
    'app/*.html',
    '.tmp/*.html'
  ])
    .pipe($.useref({searchPath: ['.tmp', 'app', '.']}))
    .pipe($.if(/\.js$/, $.uglify({compress: {drop_console: true}})))
    .pipe($.if(/\.css$/, $.cssnano({safe: true, autoprefixer: false})))
    .pipe($.if(/main\.min\.css$/, $.header(banner, {pkg: pkg})))
    .pipe($.if(/\.html$/, $.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: {compress: {drop_console: true}},
      processConditionalComments: true,
      removeComments: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true
    })))
    .pipe($.if(/\.html$/, $.size({title: 'html', showFiles: true})))
    .pipe(gulp.dest('dist'));
});
/* eslint-enable camelcase */

gulp.task('images', () => {
  return gulp.src('app/assets/images/**/*')
    .pipe($.cache($.imagemin()))
    .pipe(gulp.dest('dist/assets/images'));
});

/* eslint-disable handle-callback-err, no-unused-vars */
gulp.task('fonts', () => {
  return gulp.src(mainBowerFile('**/*.{eot,svg,ttf,woff,woff2}', err => {})
    .concat('app/assets/fonts/**/*'))
    .pipe($.if(dev, gulp.dest('.tmp/assets/fonts'), gulp.dest('dist/assets/fonts')));
});
/* eslint-disable handle-callback-err, no-unused-vars */

gulp.task('copy', () => {
  return gulp.src([
    'app/*.*',
    '!app/*.html',
    '!app/*.njk'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'));
});

gulp.task('clean', () => del(['.tmp', 'dist/*'], {dot: true}));

gulp.task('serve', () => {
  runSequence(
    ['clean', 'wiredep'],
    ['views', 'styles', 'scripts', 'fonts'],
    () => {
      browserSync({
        notify: false,
        logPrefix: 'antleblanc.me',
        server: {
          baseDir: ['.tmp', 'app'],
          routes: {
            '/bower_components': 'bower_components'
          }
        },
        port: 3000
      });

      gulp.watch([
        'app/assets/scripts/**/*.js',
        'app/assets/images/**/*',
        '.tmp/assets/fonts/**/*'
      ]).on('change', reload);

      gulp.watch('app/**/*.{html,njk}', ['views:reload']);
      gulp.watch('app/assets/styles/**/*.scss', ['styles']);
      gulp.watch('app/assets/scripts/**/*.js', ['scripts']);
      gulp.watch('app/assets/fonts/**/*', ['fonts']);
      gulp.watch('bower.json', ['wiredep', 'fonts']);
    }
  );
});

gulp.task('serve:dist', ['default'], () => {
  browserSync({
    notify: false,
    logPrefix: 'antleblanc.me',
    https: true,
    server: 'dist',
    port: 3001
  });
});

gulp.task('wiredep', () => {
  gulp.src('app/assets/styles/*.scss')
    .pipe($.filter(file => file.stat && file.stat.size))
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)+/
    }))
    .pipe(gulp.dest('app/assets/styles'));

  gulp.src('app/layouts/*.njk')
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)*\.\./,
      fileTypes: {
        njk: {
          block: /(([ \t]*)<!--\s*bower:*(\S*)\s*-->)(\n|\r|.)*?(<!--\s*endbower\s*-->)/gi,
          detect: {
            js: /<script.*src=['"]([^'"]+)/gi,
            css: /<link.*href=['"]([^'"]+)/gi
          },
          replace: {
            js: '<script src="{{filePath}}"></script>',
            css: '<link rel="stylesheet" href="{{filePath}}" />'
          }
        }
      }
    }))
    .pipe(gulp.dest('app/layouts'));
});

gulp.task('build', ['lint', 'html', 'images', 'svg', 'fonts', 'copy'], () => {
  return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
});

gulp.task('default', () => {
  return new Promise(resolve => {
    dev = false;
    runSequence(
      ['clean', 'wiredep'],
      'build',
      resolve
    );
  });
});

/* eslint-disable brace-style, max-statements-per-line */
try { require('require-dir')('tasks'); } catch (err) { console.error(err); }
/* eslint-enable brace-style, max-statements-per-line */
