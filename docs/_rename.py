# -*- coding: utf-8 -*-
import re, pathlib, sys

p = pathlib.Path(r'E:\00 - 中数通ES环境\ES 接口\docs\user-stories.md')
t = p.read_text(encoding='utf-8')
new = re.sub(r'### US-(\d{3}):', r'### US-API-\1:', t)
p.write_text(new, encoding='utf-8')

# 统计
matches = re.findall(r'### US-API-\d+:', new)
log = pathlib.Path(r'E:\00 - 中数通ES环境\ES 接口\docs\_rename_log.txt')
log.write_text(f'Replaced {len(matches)} headings\n', encoding='utf-8')
sys.exit(0)
