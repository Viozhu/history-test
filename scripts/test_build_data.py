# Unit tests for the pure segmentation helpers of build_data.py (no PDFs needed).
# Run: .venv/bin/python -m unittest scripts/test_build_data.py
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_data as bd  # noqa: E402

L = bd.Line


def header(n, page, col, y):
    x = bd.COLS[col][0]
    return bd.Header(n, page, col, L(f"{n}. 질문입니까?", x, y, x + 200, y + 14))


class FindSharedBlocks(unittest.TestCase):
    def test_ocr_bracket_variant_spans_to_first_question_header(self):
        x = bd.COLS[0][0]
        pages = [[], [L("[47~48」 다음을 읽고 물음에 답하시오.", x - 3, 75, x + 250, 90), L("(가) 9서당", x + 10, 100, x + 120, 112)]]
        heads = [header(46, 0, 1, 500), header(47, 1, 0, 377), header(48, 1, 0, 831)]
        blocks = bd.find_shared_blocks(pages, heads)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual((b.first, b.last, b.page, b.col), (47, 48, 1, 0))
        self.assertEqual(b.top, 75 - 4)
        self.assertEqual(b.bottom, 377 - 6)
        self.assertEqual([l.text for l in b.lines], ["(가) 9서당"])

    def test_text_layer_variant_with_thin_spaces(self):
        x = bd.COLS[0][0]
        pages = [[L("[47 ~ 48] 다음을 읽고 물음에 답하시오.", x, 70, x + 250, 84)]]
        heads = [header(47, 0, 0, 465), header(48, 0, 0, 780)]
        b = bd.find_shared_blocks(pages, heads)[0]
        self.assertEqual((b.first, b.last, b.bottom), (47, 48, 465 - 6))

    def test_ignores_ranges_without_instruction_wording(self):
        x = bd.COLS[0][0]
        pages = [[L("[3~4점] 연표", x, 70, x + 100, 84), L("1910~1919년", x, 120, x + 100, 134)]]
        self.assertEqual(bd.find_shared_blocks(pages, [header(5, 0, 0, 400)]), [])

    def test_block_without_header_below_runs_to_page_bottom(self):
        x = bd.COLS[1][0]
        pages = [[L("[49~50] 다음 자료를 보고 물음에 답하시오.", x, 600, x + 250, 614)]]
        heads = [header(49, 1, 0, 70), header(50, 1, 0, 400)]
        b = bd.find_shared_blocks(pages, heads)[0]
        self.assertEqual((b.first, b.last, b.page, b.col, b.bottom), (49, 50, 0, 1, bd.CONTENT_BOTTOM))


if __name__ == "__main__":
    unittest.main()
