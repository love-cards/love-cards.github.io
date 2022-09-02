import argparse
import os
import shutil
import typing as ty

import markdown
import yaml

style_link_pattern = '<link rel="stylesheet" type="text/css" href="styles/{}">'
script_link_pattern = '<script src="scripts/{}"></script>'


class WebCardsBuilder:
    def __init__(self, cards_dir: str, output_dir: str, patterns: ty.List[str],
                 layouts: ty.List[str] = [], styles: ty.List[str] = [], scripts: ty.List[str] = [],
                 content: ty.List[str] = []):

        self.patterns = {os.path.basename(p): open(p, encoding='utf-8').read() for p in patterns}
        self.layouts = {os.path.basename(p): p for p in layouts}
        self.styles = {os.path.basename(p): p for p in styles}
        self.scripts = {os.path.basename(p): p for p in scripts}
        self.content = {os.path.basename(p): p for p in content}

        self.cards_dir = cards_dir
        self.output_dir = output_dir

    def build(self):
        if not os.path.exists(self.output_dir):
            os.mkdir(self.output_dir)

        for path in ("styles", "scripts", "content"):
            path = os.path.join(self.output_dir, path)
            if os.path.exists(path):
                shutil.rmtree(path)
            os.mkdir(path)

        for category in self._generate_categories():
            category.write(self.output_dir)

        for name, layout_path in self.layouts.items():
            shutil.copy(layout_path, os.path.join(self.output_dir, name))

        for name, style_path in self.styles.items():
            shutil.copy(style_path, os.path.join(self.output_dir, "styles", name))

        for name, script_path in self.scripts.items():
            shutil.copy(script_path, os.path.join(self.output_dir, "scripts", name))

        for name, content_path in self.content.items():
            shutil.copy(content_path, os.path.join(self.output_dir, "content", name))

    def _generate_categories(self) -> ty.Iterable['WebCardCategory']:
        for category_dir in os.listdir(self.cards_dir):
            category_dir = os.path.join(self.cards_dir, category_dir)
            if os.path.isdir(category_dir):
                yield self._generate_category(category_dir)

    def _generate_category(self, category_dir: str) -> 'WebCardCategory':
        card_divs = []
        card_div_styles = []
        image_paths = []

        with open(os.path.join(category_dir, "category.yaml"), encoding='utf-8') as fp:
            config = yaml.full_load(fp.read())
            category_name = config.get("name", os.path.basename(category_dir))

        for card in self._load_cards(category_dir):
            out_image_prefix = category_name + "_" + card.name + "_"
            out_image_path = os.path.join("content", out_image_prefix + os.path.basename(card.image_path))

            card_divs.append(
                self.patterns["card.html"] \
                    .replace("<!-- title -->", card.title) \
                    .replace("<!-- number -->", card.number) \
                    .replace("<!-- content -->", card.html) \
                    .replace("<!-- classes -->", card.name))

            card_div_styles.append(
                "." + card.name + ' .header { background-image: url("../' + out_image_path + '") }')

            image_paths.append((card.image_path, out_image_path))

        styles = tuple(self.styles.keys()) + (category_name + '.css', )

        layout_text = "<!-- GENERATED FILE -->\n" + self.patterns["category.html"] \
            .replace("<!-- category-title -->", config.get("title", None) or "Untitled") \
            .replace("<!-- category-emoji -->", config.get("emoji", None) or "✨") \
            .replace("<!-- styles -->", '\n'.join(style_link_pattern.format(p) for p in styles)) \
            .replace("<!-- scripts -->", '\n'.join(script_link_pattern.format(p) for p in self.scripts.keys())) \
            .replace("<!-- cards -->", '\n'.join(card_divs))

        style_text = "/* GENERATED FILE */\n" + '\n'.join(card_div_styles)

        return WebCardCategory(category_name, layout_text, style_text, image_paths)

    @staticmethod
    def _load_cards(category_dir: str) -> ty.Iterable['WebCard']:
        number = -1
        for card_dir in sorted(os.listdir(category_dir)):
            card_dir = os.path.join(category_dir, card_dir)
            if not os.path.isdir(card_dir):
                continue

            with open(os.path.join(card_dir, "card.yaml")) as fp:
                config: dict = yaml.full_load(fp.read())
                number += 1

                yield WebCard(
                    config.get("name", None) or "c" + os.path.basename(card_dir),
                    config.get("title", None) or "Untitled",
                    os.path.join(card_dir, config.get("image", None) or "header.jpg"),
                    config.get("number", None) or str(number),
                    os.path.join(card_dir, config.get("markdown", None) or "card.md"))


class WebCardCategory:
    def __init__(self, name: str, layout_text: str, style_text: str, image_paths: ty.List[ty.Tuple[str, str]]):
        self.name = name

        self.layout_text = layout_text
        self.style_text = style_text

        self.image_paths = image_paths

    def write(self, dir_path: str):
        with open(os.path.join(dir_path, self.name + ".html"), "w", encoding="utf-8") as fp:
            fp.write(self.layout_text)

        with open(os.path.join(dir_path, "styles", self.name + ".css"), "w", encoding="utf-8") as fp:
            fp.write(self.style_text)

        for image_path, out_image_path in self.image_paths:
            shutil.copy(image_path, os.path.join(dir_path, out_image_path))


class WebCard:
    def __init__(self, name: str, title: str, image_path: str, number: str, md_path: str):
        self.name = name
        self.title = title
        self.image_path = image_path
        self.number = number
        self.md_path = md_path

    @property
    def html(self):
        with open(self.md_path, encoding="utf-8") as fp:
            return markdown.markdown(fp.read())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=str)
    parser.add_argument("-l", "--listen", action="store_true")
    args = parser.parse_args()

    config = yaml.full_load(open(os.path.join(args.path, "config.yaml")).read())

    if not args.listen:
        WebCardsBuilder(**config).build()
    else:
        import checksumdir
        import time

        prev_hash = ""
        n = 0

        while True:
            cur_hash = checksumdir.dirhash(args.path)
            if prev_hash != cur_hash:
                n += 1
                print("Rebuild", n)
                prev_hash = cur_hash
                WebCardsBuilder(**config).build()
            time.sleep(0.1)


if __name__ == '__main__':
    main()
