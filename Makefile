# .dot -> .svg, all diagrams share these defaults (override per file).
# Colours are placeholders: docs/.vitepress/theme/diagram.css repaints them from --bless-* tokens.
FONT = Roboto
DOT_FLAGS = -Tsvg -Gbgcolor=transparent -Gpad=0.2 -Gfontname=$(FONT) \
  -Nfontname=$(FONT) -Nstyle=filled -Nfillcolor="\#f2f2f2" -Ncolor="\#333333" \
  -Efontname=$(FONT) -Ecolor="\#333333"

SRC := $(shell find docs/diagrams -name '*.dot')

all: $(SRC:.dot=.svg)

%.svg: %.dot Makefile
	dot $(DOT_FLAGS) $< -o $@

.PHONY: all
