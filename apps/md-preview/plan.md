# Plan for creating the new `md-preview` application

## The Goal

With one command from a command line , I want to be able to:

- specify multiple markdown files as input
- create a new process-specific temporary directory in the operating system's
  temporary directory
- generate rendered versions of the specified markdown files in that
  process-specific temporary directory
- identify an open port (using the networkHelpers.mts module in depot-node)
- launch a simple HTTP server (using the open port) that will serve files from
  the process-specific temporary directory
- Print the sharable URL to the console so that the link can be sent to others
  on the LAN so that they may view the rendered files
- launch a system default web browser to view the process-specific temporary
  directory (using the machine's IP address (see getFirstExternalIpv4Address)
  and the server's port number).  This should open a directory listing, showing
  the directory's contents.  The user can then click on the file they want to
  view.
- prompt the user to press a key to terminate the server and exit the application
- when a key is pressed the app performs best-effort cleanup.  It should attempt
  to delete the process-specific temporary directory.
- The application will exit.

This will allow me to read or print the rendered markdown documents in the
launched web browser.  Then, when I am finished, I can close the browser and
press any key in the terminal window to stop the server and close the
application.

## Requirements

- GitHub flavored markdown must be supported.  Specifically, the features I want
  include:  tables, task lists, strikethrough, footnotes, heading IDs, and
  syntax highlighted code blocks.

- The output must be nicely formatted and readable in a web browser.  Ideally,
  CSS styling similar to GitHub markdown CSS will be applied.  I especially want
  the font to be one that is good for reading longer documents.

  - The `marked` and `markdown-it` packages seem to be good candidates to
    perform this rendering, but others may be considered if they are better
    suited to the task.

  - If the chosen renderer produces HTML fragments, the fragments must be
    wrapped in a complete HTML document with the appropriate `<html>`, `<head>`,
    and `<body>` tags.

  - All generated HTML documents may reference a shared CSS stylesheet that is
    copied into the process-specific temporary directory.  The shared CSS
    stylesheet may be a reference to a CDN or may be included in the generated
    HTML documents using a `<link>` element.

- The input files for this application can be specified via positional command
  line arguments or by piping input into this app.  See `apps\rmrf\src\main.mts`
  for an example of how this should be handled.

- Given an input file named `foo.md`, the generated HTML file should be named
  `foo.html` and placed in the process-specific temporary directory.  The folder
  structure of the input files does not need to be maintained in the output
  directory.  If two input file names have the same base name, it is ok for the
  subsequent file to overwrite the previous file.  The user does not have to be
  warned when this happens.

- relative image/link targets should be rewritten/copied into temp output

- If browser launch fails, the application should print a message to the console
  indicating that the user can manually open a browser and navigate to the
  printed URL.

- No light/dark theme switching is needed.  The application will use a single theme that is good for reading
  longer documents.

- There are no security requirements for this application.  It is intended to be used only on
  the local machine, and it will not be exposed to the internet.

- LAN sharing should be enabled.

- Raw HTML in the input markdown should be allowed.

- Add content to `apps\md-preview\README.md` to describe this application.
