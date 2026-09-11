import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)


def guess_module_name_from_filename(filename, fallback_index):
    stem = Path(filename).stem.strip()
    if not stem:
        return f"Module {fallback_index}"

    if re.fullmatch(r"output\d*", stem, flags=re.IGNORECASE):
        return f"Module {fallback_index}"

    return re.sub(r"[_\-]+", " ", stem).strip()


def extract_suite_tree(root_el):
    """Kat-bni arbre dyal suites: id, name, children, test_count, fail_count."""
    def walk(el):
        node = {
            "id": el.get("id", ""),
            "name": el.get("name", ""),
            "children": [],
            "test_count": 0,
            "fail_count": 0,
        }
        for suite in el.findall("suite"):
            child = walk(suite)
            node["children"].append(child)
            node["test_count"] += child["test_count"]
            node["fail_count"] += child["fail_count"]
        for test in el.findall("test"):
            node["test_count"] += 1
            s = test.find("status")
            if s is not None and s.get("status") == "FAIL":
                node["fail_count"] += 1
        return node

    top = root_el.find("suite")
    if top is None:
        return {}
    return walk(top)


def prefix_suite_tree_ids(node, module_id):
    """Prefix suite IDs to avoid collisions across multiple uploaded files."""
    if not node:
        return

    suite_id = node.get("id", "")
    node["id"] = f"{module_id}:{suite_id}" if suite_id else f"{module_id}:root"

    for child in node.get("children", []):
        prefix_suite_tree_ids(child, module_id)


def get_suite_path_ids(test_el):
    """
    Depuis test id "s1-s2-s1-t3" -> ["s1", "s1-s2", "s1-s2-s1"]
    """
    test_id = test_el.get("id", "")
    parts = test_id.split("-")
    path = []
    current = ""
    for p in parts:
        if p.startswith("t"):
            break
        current = current + "-" + p if current else p
        path.append(current)
    return path


def find_failed_keyword_path(element, path_list=None):
    """Kat-rj3 l-chemin dial les keywords mn l-kbir l-sghir (Hierarchical Path)."""
    if path_list is None:
        path_list = []

    if element.tag == "kw":
        lib = element.get("library", "")
        name = element.get("name", "")
        full_name = f"{lib}.{name}" if lib else name
        path_list.append(full_name)

    failed_kws = []
    for kw in element.findall("./kw"):
        status = kw.find("status")
        if status is not None and status.get("status") == "FAIL":
            failed_kws.append(kw)

    if failed_kws:
        return find_failed_keyword_path(failed_kws[-1], path_list)

    return path_list


def parse_elapsed(status_node):
    elapsed = status_node.get("elapsed", "")
    if elapsed:
        try:
            ms = int(elapsed)
            if ms < 1000:
                return f"{ms}ms"
            elif ms < 60000:
                return f"{ms/1000:.3f}s"
            else:
                s = ms // 1000
                return f"{s//60:02d}:{s%60:02d}s"
        except ValueError:
            pass
    return elapsed if elapsed else ""


def extract_timeline(test_element):
    steps = []
    failed_path = find_failed_keyword_path(test_element)
    failed_path_set = set(failed_path)

    for kw in test_element.findall("kw"):
        kw_type = kw.get("type", "kw")
        lib = kw.get("library", "")
        name = kw.get("name", "")
        full_name = f"{lib} . {name}" if lib else name

        args = []
        for arg in kw.findall("arg"):
            if arg.text:
                args.append(arg.text)

        status_node = kw.find("status")
        status = "PASS"
        elapsed_str = ""
        if status_node is not None:
            status = status_node.get("status", "PASS")
            elapsed_str = parse_elapsed(status_node)

        error_msg = ""
        if status == "FAIL":
            msg_node = kw.find(".//msg[@level='FAIL']")
            if msg_node is not None and msg_node.text:
                error_msg = msg_node.text.strip()
            else:
                msg_node2 = kw.find(".//msg")
                if msg_node2 is not None and msg_node2.text:
                    error_msg = msg_node2.text.strip()

        in_failed_path = (lib + "." + name) in failed_path_set or name in failed_path_set

        steps.append({
            "type": kw_type,
            "name": full_name,
            "args": args,
            "status": status,
            "elapsed": elapsed_str,
            "in_failed_path": in_failed_path,
            "error_msg": error_msg,
        })

    return steps


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    uploaded_files = request.files.getlist("files")
    if not uploaded_files and "file" in request.files:
        uploaded_files = [request.files["file"]]

    uploaded_files = [f for f in uploaded_files if f and f.filename]
    if not uploaded_files:
        return jsonify({"error": "Aucun fichier fourni"}), 400

    failures = []
    modules = []

    for file_index, file in enumerate(uploaded_files, start=1):
        filename = file.filename or f"module_{file_index}"
        ext = os.path.splitext(filename)[1].lower()
        module_id = f"m{file_index}"
        module_name = guess_module_name_from_filename(filename, file_index)

        module_failed_count = 0
        module_suite_tree = {}
        module_test_count = 0

        if ext == ".xml":
            try:
                tree = ET.parse(file)
                root = tree.getroot()

                top_suite = root.find("suite")
                top_suite_name = (top_suite.get("name", "") if top_suite is not None else "").strip()
                if top_suite_name:
                    module_name = top_suite_name

                module_suite_tree = extract_suite_tree(root)
                if module_suite_tree:
                    module_test_count = module_suite_tree.get("test_count", 0)
                    prefix_suite_tree_ids(module_suite_tree, module_id)

                suite_id_map = {}
                for suite in root.findall(".//suite"):
                    raw_id = suite.get("id", "")
                    prefixed_id = f"{module_id}:{raw_id}" if raw_id else f"{module_id}:root"
                    suite_id_map[prefixed_id] = suite.get("name", "")

                for test in root.findall(".//test"):
                    status_node = test.find("status")
                    if status_node is not None and status_node.get("status") == "FAIL":
                        case_name = test.get("name", "Cas inconnu")

                        error_message = (status_node.text or "").strip()
                        if not error_message:
                            msg_node = test.find(".//msg[@status='FAIL']")
                            if msg_node is not None and msg_node.text:
                                error_message = msg_node.text.strip()
                            else:
                                error_message = "Échec sans message d'erreur précis dans le XML."

                        path_list = find_failed_keyword_path(test)
                        failed_keyword_path = " ➔ ".join(path_list) if path_list else "Keyword inconnu"

                        timeline = extract_timeline(test)

                        test_status_node = test.find("status")
                        elapsed_total = parse_elapsed(test_status_node) if test_status_node is not None else ""
                        start_time = test_status_node.get("starttime", "") if test_status_node is not None else ""

                        tags = [t.text for t in test.findall(".//tag") if t.text]
                        doc_node = test.find("doc")
                        documentation = doc_node.text.strip() if doc_node is not None and doc_node.text else ""

                        raw_suite_path_ids = get_suite_path_ids(test)
                        suite_path_ids = [f"{module_id}:{sid}" for sid in raw_suite_path_ids]
                        suite_path = [
                            {"id": sid, "name": suite_id_map.get(sid, sid)}
                            for sid in suite_path_ids
                        ]

                        failures.append({
                            "module_id": module_id,
                            "module_name": module_name,
                            "source_file": filename,
                            "case_name": case_name,
                            "keyword": failed_keyword_path,
                            "error_message": error_message,
                            "timeline": timeline,
                            "start_time": start_time,
                            "elapsed": elapsed_total,
                            "tags": tags,
                            "documentation": documentation,
                            "suite_path": suite_path,
                            "suite_ids": suite_path_ids,
                        })
                        module_failed_count += 1
            except Exception as e:
                return jsonify({"error": f"Erreur de lecture XML ({filename}) : {str(e)}"}), 500

        elif ext == ".html":
            content = file.read().decode("utf-8", errors="ignore")
            matches = re.findall(
                r'["\']name["\']:["\'](.*?)["\'].*?["\']status["\']:["\']FAIL["\'].*?["\']message["\']:["\'](.*?)["\']',
                content,
            )
            for match in matches:
                failures.append({
                    "module_id": module_id,
                    "module_name": module_name,
                    "source_file": filename,
                    "case_name": match[0],
                    "keyword": "Analyse via XML recommandée pour voir l'arborescence",
                    "error_message": match[1],
                    "timeline": [],
                    "start_time": "",
                    "elapsed": "",
                    "tags": [],
                    "documentation": "",
                    "suite_path": [],
                    "suite_ids": [],
                })
                module_failed_count += 1

        modules.append({
            "id": module_id,
            "name": module_name,
            "source_file": filename,
            "failed_count": module_failed_count,
            "test_count": module_test_count,
            "suite_tree": module_suite_tree,
        })

    return jsonify({
        "failed_count": len(failures),
        "failures": failures,
        "modules": modules,
    })


def analyze_with_all_cases():
    uploaded_files = request.files.getlist("files")
    if not uploaded_files and "file" in request.files:
        uploaded_files = [request.files["file"]]

    uploaded_files = [f for f in uploaded_files if f and f.filename]
    if not uploaded_files:
        return jsonify({"error": "Aucun fichier fourni"}), 400

    cases = []
    failures = []
    modules = []

    for file_index, file in enumerate(uploaded_files, start=1):
        filename = file.filename or f"module_{file_index}"
        ext = os.path.splitext(filename)[1].lower()
        module_id = f"m{file_index}"
        module_name = guess_module_name_from_filename(filename, file_index)
        module_failed_count = 0
        module_success_count = 0
        module_suite_tree = {}
        module_test_count = 0

        if ext == ".xml":
            try:
                tree = ET.parse(file)
                root = tree.getroot()
                top_suite = root.find("suite")
                top_suite_name = (top_suite.get("name", "") if top_suite is not None else "").strip()
                if top_suite_name:
                    module_name = top_suite_name

                module_suite_tree = extract_suite_tree(root)
                if module_suite_tree:
                    module_test_count = module_suite_tree.get("test_count", 0)
                    prefix_suite_tree_ids(module_suite_tree, module_id)

                suite_id_map = {}
                for suite in root.findall(".//suite"):
                    raw_id = suite.get("id", "")
                    prefixed_id = f"{module_id}:{raw_id}" if raw_id else f"{module_id}:root"
                    suite_id_map[prefixed_id] = suite.get("name", "")

                for test in root.findall(".//test"):
                    status_node = test.find("status")
                    if status_node is None:
                        continue

                    status = (status_node.get("status") or "").upper()
                    if not status:
                        continue

                    is_fail = status == "FAIL"
                    case_name = test.get("name", "Cas inconnu")
                    error_message = (status_node.text or "").strip()
                    if is_fail and not error_message:
                        msg_node = test.find(".//msg[@status='FAIL']")
                        error_message = (
                            msg_node.text.strip()
                            if msg_node is not None and msg_node.text
                            else "Echec sans message d'erreur precis dans le XML."
                        )
                    if not is_fail:
                        error_message = ""

                    path_list = find_failed_keyword_path(test) if is_fail else []
                    keyword = " ➔ ".join(path_list) if path_list else ("Keyword inconnu" if is_fail else "Test reussi")
                    suite_path_ids = [f"{module_id}:{sid}" for sid in get_suite_path_ids(test)]
                    suite_path = [{"id": sid, "name": suite_id_map.get(sid, sid)} for sid in suite_path_ids]
                    doc_node = test.find("doc")

                    case_item = {
                        "module_id": module_id,
                        "module_name": module_name,
                        "source_file": filename,
                        "status": status,
                        "case_name": case_name,
                        "keyword": keyword,
                        "error_message": error_message,
                        "timeline": extract_timeline(test),
                        "start_time": status_node.get("starttime", ""),
                        "elapsed": parse_elapsed(status_node),
                        "tags": [t.text for t in test.findall(".//tag") if t.text],
                        "documentation": doc_node.text.strip() if doc_node is not None and doc_node.text else "",
                        "suite_path": suite_path,
                        "suite_ids": suite_path_ids,
                    }
                    cases.append(case_item)
                    if is_fail:
                        failures.append(case_item)
                        module_failed_count += 1
                    elif status == "PASS":
                        module_success_count += 1
            except Exception as e:
                return jsonify({"error": f"Erreur de lecture XML ({filename}) : {str(e)}"}), 500
        elif ext == ".html":
            content = file.read().decode("utf-8", errors="ignore")
            matches = re.findall(
                r'["\']name["\']:["\'](.*?)["\'].*?["\']status["\']:["\']FAIL["\'].*?["\']message["\']:["\'](.*?)["\']',
                content,
            )
            for match in matches:
                case_item = {
                    "module_id": module_id,
                    "module_name": module_name,
                    "source_file": filename,
                    "status": "FAIL",
                    "case_name": match[0],
                    "keyword": "Analyse via XML recommandee pour voir l'arborescence",
                    "error_message": match[1],
                    "timeline": [],
                    "start_time": "",
                    "elapsed": "",
                    "tags": [],
                    "documentation": "",
                    "suite_path": [],
                    "suite_ids": [],
                }
                failures.append(case_item)
                cases.append(case_item)
                module_failed_count += 1

        modules.append({
            "id": module_id,
            "name": module_name,
            "source_file": filename,
            "failed_count": module_failed_count,
            "success_count": module_success_count,
            "test_count": module_test_count or len([c for c in cases if c["module_id"] == module_id]),
            "suite_tree": module_suite_tree,
        })

    return jsonify({
        "failed_count": len(failures),
        "success_count": len([case for case in cases if case.get("status") == "PASS"]),
        "total_count": len(cases),
        "cases": cases,
        "failures": failures,
        "modules": modules,
    })


app.view_functions["analyze"] = analyze_with_all_cases


if __name__ == "__main__":
    app.run(debug=True, port=5000)
