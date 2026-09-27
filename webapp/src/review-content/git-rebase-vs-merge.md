---
key: "Rebase vs Merge"
title: "Git Rebase vs Merge & Branching Workflow"
crumb: "16. Linux & Deployment › Git"
---

Merge và rebase cùng giải quyết một việc — đưa thay đổi của branch này vào branch khác — nhưng để lại lịch sử khác nhau. Chọn sai chỗ dùng rebase là cách nhanh nhất để làm hỏng branch của cả team. Nguyên tắc vàng từ *Pro Git*: **"Do not rebase commits that exist outside your repository and that people may have based work on."**

## Điểm Chính

- **Merge**: tạo *merge commit* có hai cha, giữ nguyên lịch sử như nó đã xảy ra. Không viết lại commit nào → an toàn với branch dùng chung.
- **Fast-forward**: nếu branch đích chưa có commit mới kể từ khi tách ra, Git chỉ dời con trỏ lên, không tạo merge commit. `--no-ff` ép tạo merge commit để giữ dấu vết "đây là một feature".
- **Rebase**: lấy diff của từng commit trên branch hiện tại, **áp lại** lên đầu branch đích → tạo commit **mới** (hash mới), lịch sử thẳng hàng. Snapshot cuối giống merge, lịch sử khác.
- **Interactive rebase** (`git rebase -i`): sửa lại commit trước khi chia sẻ — `squash`/`fixup` gộp, `reword` đổi message, `edit` tách commit, `drop` bỏ, đổi thứ tự.
- **Squash merge** (tùy chọn trên GitHub/GitLab): gộp toàn bộ PR thành một commit trên `main` — lịch sử `main` gọn, mất chi tiết từng commit trong PR.
- **Sau khi rebase một branch đã push** phải force push. Dùng `git push --force-with-lease` (từ chối nếu remote đã đổi so với lần fetch cuối của bạn) thay cho `--force`; thêm `--force-if-includes` để phòng trường hợp có tiến trình fetch ngầm cập nhật remote-tracking branch.
- **Cherry-pick**: áp một commit cụ thể lên branch khác (thường dùng backport hotfix sang release branch).

## Ví Dụ Code

*Merge vs rebase — cùng điểm xuất phát*

```bash
# Lịch sử ban đầu:
#       C1 — C2        (feature)
#      /
# A — B — M1 — M2      (main)

# Cách 1: merge main vào feature (hoặc feature vào main)
git switch feature
git merge main
#       C1 — C2 — MC   (feature)   MC là merge commit có 2 cha: C2 và M2
#      /         /
# A — B — M1 — M2

# Cách 2: rebase feature lên main
git switch feature
git rebase main
# A — B — M1 — M2 — C1' — C2'     (feature)   C1', C2' là commit MỚI, hash khác C1, C2
```

*Xử lý conflict khi rebase*

```bash
git rebase main
# CONFLICT (content): Merge conflict in OrderService.java
# → Sửa file, rồi:
git add OrderService.java
git rebase --continue      # áp tiếp commit kế tiếp (có thể conflict lại ở commit sau)
git rebase --abort         # hoặc bỏ cuộc, quay về trạng thái trước rebase
```

*Dọn commit trước khi mở PR*

```bash
git rebase -i main
# Trình soạn thảo mở ra:
# pick   3f1a2b1 feat: add CSV export
# fixup  8c9d0e2 fix typo              ← gộp vào commit trên, bỏ message
# squash 7b6a5c4 handle empty list     ← gộp vào commit trên, giữ message để sửa
# reword 1a2b3c4 add test              ← giữ commit, sửa message
# drop   9e8f7a6 debug logging         ← bỏ commit

# Sửa commit gần nhất (chưa push)
git commit --amend

# Branch đã push trước đó → force push an toàn
git push --force-with-lease --force-if-includes
```

*Workflow "fixup" gọn gàng*

```bash
git commit --fixup=3f1a2b1          # tạo commit "fixup! feat: add CSV export"
git rebase -i --autosquash main     # tự động xếp và đánh dấu fixup
```

*Cherry-pick hotfix sang release branch*

```bash
git switch release/2.3
git cherry-pick -x 4d5e6f7          # -x: ghi "(cherry picked from commit ...)" vào message
```

*Cập nhật branch mà không tạo merge commit thừa*

```bash
git pull --rebase                    # áp commit local lên đầu origin/feature
git config --global pull.rebase true # đặt làm mặc định
```

## Ứng Dụng Thực Tế

**Quy ước phổ biến trong team**:
- Branch cá nhân chưa ai khác dùng: rebase thoải mái lên `main` để cập nhật và `rebase -i` để dọn commit trước khi mở PR.
- Branch dùng chung (`main`, `develop`, `release/*`): chỉ merge, cấm force push (branch protection).
- Merge PR vào `main`: chọn *squash merge* (một PR = một commit, dễ revert cả feature) hoặc *rebase merge* (lịch sử thẳng, giữ từng commit) hoặc *merge commit* (giữ nguyên nhánh). Team nên thống nhất một kiểu.

**Trunk-based development vs Git Flow**: Git Flow (`develop`, `release/*`, `hotfix/*`) hợp với phần mềm phát hành theo đợt, nhiều version song song. Trunk-based (branch ngắn ngày, merge vào `main` hằng ngày, tính năng chưa xong ẩn sau feature flag) hợp với CI/CD deploy liên tục — ít conflict lớn vì branch không sống lâu.

**Rebase lại lịch sử đã chia sẻ** gây ra: đồng nghiệp đã tạo branch từ commit cũ → khi họ pull sẽ thấy commit trùng lặp (bản cũ và bản rebase) và conflict khó hiểu.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào dùng merge, khi nào dùng rebase?</strong></summary>

**A:** Rebase cho commit **chỉ có ở local hoặc branch cá nhân**: cập nhật feature branch theo `main`, dọn lịch sử trước khi mở PR — kết quả lịch sử thẳng, dễ đọc, dễ `bisect`. Merge cho việc tích hợp vào **branch dùng chung** và khi muốn giữ lịch sử đúng như đã xảy ra, vì merge không viết lại commit nào. Quy tắc từ Pro Git: rebase thay đổi local trước khi push để làm sạch, nhưng không bao giờ rebase thứ đã push lên nơi người khác có thể đã dựa vào.

</details>

<details>
<summary><strong>Tại sao rebase branch đã push lại nguy hiểm?</strong></summary>

**A:** Rebase tạo commit mới với hash mới rồi bỏ commit cũ. Người khác đã pull commit cũ và làm tiếp trên đó; sau khi bạn force push, lịch sử của họ và remote phân kỳ — pull sẽ merge cả bản cũ lẫn bản mới (commit trùng lặp), conflict lặp đi lặp lại, và nếu họ force push lại thì có thể xóa mất commit của bạn. Nếu buộc phải làm (ví dụ branch PR của riêng bạn), báo trước và dùng `--force-with-lease`.

</details>

<details>
<summary><strong>--force-with-lease khác --force thế nào?</strong></summary>

**A:** `--force` ghi đè branch remote bất kể trên đó có gì — có thể xóa commit đồng nghiệp vừa push. `--force-with-lease` chỉ ghi đè nếu branch remote vẫn đang ở đúng vị trí mà remote-tracking branch của bạn ghi nhận (tức chưa ai push thêm kể từ lần fetch cuối); nếu khác thì từ chối. Hạn chế: nếu có tiến trình chạy `git fetch` ngầm (IDE, cronjob), remote-tracking branch đã được cập nhật nên kiểm tra vẫn qua. Thêm `--force-if-includes` để Git kiểm tra thêm rằng các cập nhật đó đã được tích hợp vào branch local của bạn.

</details>

<details>
<summary><strong>Fast-forward merge là gì? Tại sao có team dùng --no-ff?</strong></summary>

**A:** Khi branch đích không có commit mới kể từ lúc branch nguồn tách ra, merge chỉ cần dời con trỏ đích lên commit cuối của nguồn — không có merge commit, lịch sử thẳng. `--no-ff` ép tạo merge commit ngay cả khi fast-forward được, để giữ dấu vết nhóm commit này thuộc một feature và có thể revert cả feature bằng một lệnh `git revert -m 1 <merge-commit>`.

</details>

<details>
<summary><strong>Squash merge có nhược điểm gì?</strong></summary>

**A:** Ưu: mỗi PR là một commit trên `main`, lịch sử gọn, revert cả feature dễ. Nhược: mất lịch sử chi tiết trong PR (bisect chỉ trỏ được tới cả PR), và commit trên `main` không phải là commit gốc của branch — nếu tiếp tục làm trên branch cũ rồi merge lần nữa, Git không biết phần nào đã vào `main` → conflict. Vì vậy sau squash merge nên xóa branch và tạo branch mới từ `main`.

</details>
